#!/usr/bin/env python3
"""Build per-source Cross-trait heatmap/correlation payloads for the web API.

This script is intentionally downstream of build_trait_effect_neighbors.py.  It
reuses that script's prepared matrix work directory, then materializes the
default UI payloads as small gzip JSON files that the Node API can slice without
opening the large TSV files during a request.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

# Workers mostly read numpy memmaps and gzip/json source payloads.  Keep BLAS
# libraries from creating extra thread pools inside each process.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import numpy as np


DEFAULT_CROSS_TRAIT_DIR = Path(
    "/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/"
    "outputs/cross_trait_heatmap"
)
DEFAULT_EFFECTS_DIR = DEFAULT_CROSS_TRAIT_DIR / "tables" / "effects"
DEFAULT_NEIGHBORS_FILE = DEFAULT_CROSS_TRAIT_DIR / "trait_effect_neighbors.json"
DEFAULT_WORK_DIR = DEFAULT_CROSS_TRAIT_DIR / ".trait_effect_neighbors_work"
DEFAULT_OUTPUT_DIR = DEFAULT_CROSS_TRAIT_DIR / "precomputed" / "current"
PRECOMPUTED_VERSION = 1

_WORKER_EFFECTS_DIR = None
_WORKER_OUTPUT_DIR = None
_WORKER_TRAIT_INDEX = None
_WORKER_GENE_INDEX = None
_WORKER_VALID_COUNTS = None
_WORKER_VALUES = None
_WORKER_CORRELATIONS = None
_WORKER_SHARED_GENES = None
_WORKER_TOP_GENES = 100
_WORKER_TOP_TARGETS = 100
_WORKER_MIN_TARGET_SHARED_GENES = 1000
_WORKER_BUILD_CORRELATION = False
_WORKER_MIN_CORRELATION_SHARED_GENES = 100
_WORKER_GENERATED_AT = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Precompute per-source Cross-trait API payloads from effect TSV "
            "files and the Trait Effect neighbor/correlation work directory."
        )
    )
    parser.add_argument("--effects-dir", type=Path, default=DEFAULT_EFFECTS_DIR)
    parser.add_argument("--neighbors-file", type=Path, default=DEFAULT_NEIGHBORS_FILE)
    parser.add_argument("--work-dir", type=Path, default=DEFAULT_WORK_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--top-genes", type=int, default=100)
    parser.add_argument("--top-targets", type=int, default=100)
    parser.add_argument(
        "--min-target-shared-genes",
        type=int,
        default=1000,
        help="Match API target recommendation filtering; lower only if needed.",
    )
    parser.add_argument(
        "--source-id",
        action="append",
        default=[],
        help="Build only this source trait id. Can be repeated for validation.",
    )
    parser.add_argument(
        "--max-sources",
        type=int,
        help="Build only the first N selected sources; intended for validation.",
    )
    parser.add_argument(
        "--skip-correlation",
        action="store_true",
        help="Only build heatmap payloads even if correlation matrices exist.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Do not rebuild source files that already exist in the output dir.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=max(1, min(16, (os.cpu_count() or 2) - 1)),
        help="Number of source traits to precompute in parallel.",
    )
    parser.add_argument(
        "--progress-seconds",
        type=float,
        default=15.0,
        help="Minimum interval between progress messages.",
    )
    return parser.parse_args()


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def validate_args(args: argparse.Namespace) -> None:
    if args.top_genes < 1:
        raise ValueError("--top-genes must be positive")
    if args.top_targets < 1:
        raise ValueError("--top-targets must be positive")
    if args.min_target_shared_genes < 1:
        raise ValueError("--min-target-shared-genes must be positive")
    if args.workers < 1:
        raise ValueError("--workers must be positive")
    if args.max_sources is not None and args.max_sources < 1:
        raise ValueError("--max-sources must be positive")


def safe_trait_id(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
    return text if all(char in allowed for char in text) else ""


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_neighbors(path: Path) -> dict:
    payload = load_json(path)
    neighbors = payload.get("neighbors")
    if not isinstance(neighbors, dict):
        raise ValueError(f"Invalid neighbors JSON: {path}")
    return payload


def load_work_metadata(work_dir: Path) -> dict:
    metadata_path = work_dir / "metadata.json"
    if not metadata_path.is_file():
        raise FileNotFoundError(
            f"Missing prepared metadata: {metadata_path}. "
            "Run build_trait_effect_neighbors.py first and keep its work dir."
        )
    metadata = load_json(metadata_path)
    if not isinstance(metadata.get("trait_ids"), list):
        raise ValueError(f"Invalid prepared metadata: {metadata_path}")
    if not isinstance(metadata.get("gene_ids"), list):
        raise ValueError(f"Prepared metadata is missing gene_ids: {metadata_path}")
    return metadata


def parse_effect_rows(path: Path) -> Iterable[dict]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        try:
            header = next(reader)
        except StopIteration:
            return

        columns = {name.strip(): index for index, name in enumerate(header)}
        if "post_mean" not in columns:
            raise ValueError(f"Missing post_mean column: {path}")
        if "ensg" not in columns and "gene" not in columns:
            raise ValueError(f"Missing ensg/gene column: {path}")

        ensg_index = columns.get("ensg")
        gene_index = columns.get("gene")
        value_index = columns["post_mean"]
        required_index = max(
            value_index,
            ensg_index if ensg_index is not None else -1,
            gene_index if gene_index is not None else -1,
        )
        seen_genes = set()

        for fields in reader:
            if len(fields) <= required_index:
                continue
            ensg = fields[ensg_index].strip() if ensg_index is not None else ""
            gene = fields[gene_index].strip() if gene_index is not None else ""
            gene_key = ensg or gene
            if not gene_key or gene_key in seen_genes:
                continue

            try:
                value = float(fields[value_index])
            except (TypeError, ValueError):
                continue
            if not math.isfinite(value):
                continue

            seen_genes.add(gene_key)
            yield {
                "ensg": ensg,
                "gene": gene,
                "sourcePostMean": value,
                "geneKey": gene_key,
            }


def build_top_genes(path: Path, gene_index: dict[str, int], limit: int) -> list[dict]:
    rows = [
        row
        for row in parse_effect_rows(path)
        if row["geneKey"] in gene_index
    ]
    rows.sort(key=lambda row: (-abs(row["sourcePostMean"]), row["geneKey"]))
    return rows[:limit]


def finite_or_none(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def int_or_zero(value) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return number if number >= 0 else 0


def summarize_matrix(matrix: list[list[float | None]]) -> dict:
    missing_cells = 0
    min_value = None
    max_value = None

    for row in matrix:
        for value in row:
            if value is None:
                missing_cells += 1
                continue
            min_value = value if min_value is None else min(min_value, value)
            max_value = value if max_value is None else max(max_value, value)

    return {
        "missingCells": missing_cells,
        "valueRange": {"min": min_value, "max": max_value},
    }


def summarize_correlation_matrix(
    matrix: list[list[float | None]],
    shared_gene_counts: list[list[int]],
) -> dict:
    valid_pair_count = 0
    missing_pair_count = 0
    min_correlation = None
    max_correlation = None
    min_shared = None
    max_shared = None

    for row_index in range(len(matrix)):
        for col_index in range(row_index + 1, len(matrix)):
            shared = shared_gene_counts[row_index][col_index]
            min_shared = shared if min_shared is None else min(min_shared, shared)
            max_shared = shared if max_shared is None else max(max_shared, shared)

            value = matrix[row_index][col_index]
            if value is None:
                missing_pair_count += 1
                continue
            valid_pair_count += 1
            min_correlation = value if min_correlation is None else min(min_correlation, value)
            max_correlation = value if max_correlation is None else max(max_correlation, value)

    return {
        "validPairCount": valid_pair_count,
        "missingPairCount": missing_pair_count,
        "correlationRange": {"min": min_correlation, "max": max_correlation},
        "sharedGeneRange": {"min": min_shared, "max": max_shared},
    }


def write_json_gzip_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    raw = json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=6)
    with temp_path.open("wb") as handle:
        handle.write(compressed)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp_path, path)


def write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    with temp_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp_path, path)


def select_target_records(
    source_id: str,
    neighbor_rows: list,
    trait_index: dict[str, int],
    top_targets: int,
    min_shared_genes: int,
) -> list[dict]:
    records = []
    seen = {source_id}

    for row in neighbor_rows:
        if not isinstance(row, dict):
            continue
        target_id = safe_trait_id(row.get("target_id", ""))
        if not target_id or target_id in seen or target_id not in trait_index:
            continue
        shared_genes = int_or_zero(row.get("shared_genes"))
        if shared_genes < min_shared_genes:
            continue
        correlation = finite_or_none(row.get("correlation"))
        if correlation is None:
            continue

        seen.add(target_id)
        records.append({
            "trait_id": target_id,
            "selection_rank": len(records) + 1,
            "selection_basis": "trait_effect_similarity",
            "correlation": round(correlation, 8),
            "shared_genes": shared_genes,
        })
        if len(records) >= top_targets:
            break

    return records


def matrix_values_for_genes(
    values: np.ndarray,
    target_indices: list[int],
    gene_indices: list[int],
) -> list[list[float | None]]:
    matrix = []
    for gene_index in gene_indices:
        row = values[target_indices, gene_index]
        matrix.append([finite_or_none(value) for value in row])
    return matrix


def correlation_values_for_traits(
    correlations: np.ndarray,
    shared_genes: np.ndarray,
    trait_indices: list[int],
) -> tuple[list[list[float | None]], list[list[int]]]:
    matrix = []
    shared_gene_counts = []
    for row_index in trait_indices:
        matrix.append([
            finite_or_none(correlations[row_index, col_index])
            for col_index in trait_indices
        ])
        shared_gene_counts.append([
            int_or_zero(shared_genes[row_index, col_index])
            for col_index in trait_indices
        ])
    return matrix, shared_gene_counts


def should_skip_source(
    output_dir: Path,
    source_id: str,
    build_correlation: bool,
    skip_existing: bool,
) -> bool:
    if not skip_existing:
        return False
    matrix_path = output_dir / "matrix" / f"{source_id}.json.gz"
    if not matrix_path.is_file():
        return False
    if build_correlation:
        correlation_path = output_dir / "correlation" / f"{source_id}.spearman.json.gz"
        return correlation_path.is_file()
    return True


def init_source_worker(
    effects_dir: str,
    output_dir: str,
    work_dir: str,
    trait_ids: list[str],
    gene_ids: list[str],
    valid_counts: list[int],
    top_genes: int,
    top_targets: int,
    min_target_shared_genes: int,
    build_correlation: bool,
    min_correlation_shared_genes: int,
    generated_at: str,
) -> None:
    global _WORKER_EFFECTS_DIR
    global _WORKER_OUTPUT_DIR
    global _WORKER_TRAIT_INDEX
    global _WORKER_GENE_INDEX
    global _WORKER_VALID_COUNTS
    global _WORKER_VALUES
    global _WORKER_CORRELATIONS
    global _WORKER_SHARED_GENES
    global _WORKER_TOP_GENES
    global _WORKER_TOP_TARGETS
    global _WORKER_MIN_TARGET_SHARED_GENES
    global _WORKER_BUILD_CORRELATION
    global _WORKER_MIN_CORRELATION_SHARED_GENES
    global _WORKER_GENERATED_AT

    worker_work_dir = Path(work_dir)
    _WORKER_EFFECTS_DIR = Path(effects_dir)
    _WORKER_OUTPUT_DIR = Path(output_dir)
    _WORKER_TRAIT_INDEX = {trait_id: index for index, trait_id in enumerate(trait_ids)}
    _WORKER_GENE_INDEX = {
        gene_id: index
        for index, gene_id in enumerate(gene_ids)
        if gene_id
    }
    _WORKER_VALID_COUNTS = [int_or_zero(value) for value in valid_counts]
    _WORKER_VALUES = np.load(worker_work_dir / "values.npy", mmap_mode="r")
    _WORKER_TOP_GENES = top_genes
    _WORKER_TOP_TARGETS = top_targets
    _WORKER_MIN_TARGET_SHARED_GENES = min_target_shared_genes
    _WORKER_BUILD_CORRELATION = build_correlation
    _WORKER_MIN_CORRELATION_SHARED_GENES = min_correlation_shared_genes
    _WORKER_GENERATED_AT = generated_at

    if build_correlation:
        _WORKER_CORRELATIONS = np.load(worker_work_dir / "correlations.npy", mmap_mode="r")
        _WORKER_SHARED_GENES = np.load(worker_work_dir / "shared_genes.npy", mmap_mode="r")
    else:
        _WORKER_CORRELATIONS = None
        _WORKER_SHARED_GENES = None


def build_source_payloads_worker(task: tuple[str, list, bool]) -> dict:
    source_id, neighbor_rows, skip_existing = task

    if should_skip_source(
        _WORKER_OUTPUT_DIR,
        source_id,
        _WORKER_BUILD_CORRELATION,
        skip_existing,
    ):
        return {
            "source_id": source_id,
            "matrix_count": 0,
            "correlation_count": 0,
            "skipped_count": 1,
            "skip_reason": "existing",
            "target_count": None,
            "gene_count": None,
        }

    effect_path = _WORKER_EFFECTS_DIR / f"{source_id}.tsv"
    if not effect_path.is_file():
        return {
            "source_id": source_id,
            "matrix_count": 0,
            "correlation_count": 0,
            "skipped_count": 1,
            "skip_reason": "missing_effect_tsv",
            "target_count": None,
            "gene_count": None,
        }

    target_records = select_target_records(
        source_id,
        neighbor_rows,
        _WORKER_TRAIT_INDEX,
        _WORKER_TOP_TARGETS,
        _WORKER_MIN_TARGET_SHARED_GENES,
    )
    if not target_records:
        return {
            "source_id": source_id,
            "matrix_count": 0,
            "correlation_count": 0,
            "skipped_count": 1,
            "skip_reason": "no_targets",
            "target_count": 0,
            "gene_count": None,
        }

    top_genes = build_top_genes(effect_path, _WORKER_GENE_INDEX, _WORKER_TOP_GENES)
    if not top_genes:
        return {
            "source_id": source_id,
            "matrix_count": 0,
            "correlation_count": 0,
            "skipped_count": 1,
            "skip_reason": "no_top_genes",
            "target_count": len(target_records),
            "gene_count": 0,
        }

    target_indices = [_WORKER_TRAIT_INDEX[record["trait_id"]] for record in target_records]
    gene_indices = [_WORKER_GENE_INDEX[row["geneKey"]] for row in top_genes]
    heatmap_matrix = matrix_values_for_genes(_WORKER_VALUES, target_indices, gene_indices)
    heatmap_payload = {
        "version": PRECOMPUTED_VERSION,
        "kind": "cross_trait_heatmap_matrix",
        "generatedAt": _WORKER_GENERATED_AT,
        "sourceId": source_id,
        "effectColumn": "post_mean",
        "geneKey": "ensg_then_gene",
        "targets": target_records,
        "genes": [
            {
                "ensg": row["ensg"],
                "gene": row["gene"],
                "sourcePostMean": row["sourcePostMean"],
            }
            for row in top_genes
        ],
        "matrix": heatmap_matrix,
        "summary": {
            "topGenes": len(top_genes),
            "targetCount": len(target_records),
            "skippedTargets": 0,
            **summarize_matrix(heatmap_matrix),
        },
    }
    write_json_gzip_atomic(
        _WORKER_OUTPUT_DIR / "matrix" / f"{source_id}.json.gz",
        heatmap_payload,
    )

    correlation_count = 0
    if _WORKER_BUILD_CORRELATION and _WORKER_CORRELATIONS is not None and _WORKER_SHARED_GENES is not None:
        trait_records = [{
            "trait_id": source_id,
            "role": "source",
            "valid_gene_count": int_or_zero(_WORKER_VALID_COUNTS[_WORKER_TRAIT_INDEX[source_id]]),
        }]
        trait_records.extend({
            **record,
            "valid_gene_count": int_or_zero(_WORKER_VALID_COUNTS[_WORKER_TRAIT_INDEX[record["trait_id"]]]),
        } for record in target_records)
        trait_indices = [_WORKER_TRAIT_INDEX[record["trait_id"]] for record in trait_records]
        correlation_matrix, shared_gene_counts = correlation_values_for_traits(
            _WORKER_CORRELATIONS,
            _WORKER_SHARED_GENES,
            trait_indices,
        )
        correlation_payload = {
            "version": PRECOMPUTED_VERSION,
            "kind": "cross_trait_correlation",
            "generatedAt": _WORKER_GENERATED_AT,
            "sourceId": source_id,
            "method": "spearman",
            "minSharedGenes": _WORKER_MIN_CORRELATION_SHARED_GENES,
            "pairwiseComplete": True,
            "traits": trait_records,
            "matrix": correlation_matrix,
            "sharedGeneCounts": shared_gene_counts,
            "summary": {
                "method": "spearman",
                "traitCount": len(trait_records),
                "requestedTraitCount": len(trait_records),
                "skippedTraits": 0,
                "profileGeneRange": {
                    "min": min(record["valid_gene_count"] for record in trait_records),
                    "max": max(record["valid_gene_count"] for record in trait_records),
                },
                **summarize_correlation_matrix(correlation_matrix, shared_gene_counts),
            },
        }
        write_json_gzip_atomic(
            _WORKER_OUTPUT_DIR / "correlation" / f"{source_id}.spearman.json.gz",
            correlation_payload,
        )
        correlation_count = 1

    return {
        "source_id": source_id,
        "matrix_count": 1,
        "correlation_count": correlation_count,
        "skipped_count": 0,
        "skip_reason": None,
        "target_count": len(target_records),
        "gene_count": len(top_genes),
    }


def main() -> int:
    args = parse_args()
    validate_args(args)

    effects_dir = args.effects_dir.resolve()
    neighbors_file = args.neighbors_file.resolve()
    work_dir = args.work_dir.resolve()
    output_dir = args.output_dir.resolve()

    metadata = load_work_metadata(work_dir)
    neighbors_payload = load_neighbors(neighbors_file)
    neighbors = neighbors_payload["neighbors"]
    trait_ids = [safe_trait_id(trait_id) for trait_id in metadata["trait_ids"]]
    if any(not trait_id for trait_id in trait_ids):
        raise ValueError("Prepared metadata contains unsafe or empty trait ids")

    trait_index = {trait_id: index for index, trait_id in enumerate(trait_ids)}
    gene_ids = [str(gene_id or "") for gene_id in metadata["gene_ids"]]
    valid_counts = metadata.get("valid_counts") or [0] * len(trait_ids)
    values_path = work_dir / "values.npy"
    if not values_path.is_file():
        raise FileNotFoundError(f"Missing prepared values matrix: {values_path}")

    build_correlation = not args.skip_correlation
    if build_correlation:
        correlations_path = work_dir / "correlations.npy"
        shared_path = work_dir / "shared_genes.npy"
        if not correlations_path.is_file() or not shared_path.is_file():
            build_correlation = False
            log(
                "Correlation matrices are missing; building heatmap payloads only. "
                f"Expected {correlations_path} and {shared_path}"
            )

    requested_sources = [safe_trait_id(source_id) for source_id in args.source_id]
    requested_sources = [source_id for source_id in requested_sources if source_id]
    source_ids = requested_sources or trait_ids
    source_ids = [
        source_id
        for source_id in source_ids
        if source_id in trait_index and source_id in neighbors
    ]
    if args.max_sources is not None:
        source_ids = source_ids[:args.max_sources]
    if not source_ids:
        raise RuntimeError("No source traits matched the requested inputs")

    log(
        "Building Cross-trait precomputed payloads: "
        f"sources={len(source_ids):,}, topGenes={args.top_genes}, "
        f"topTargets={args.top_targets}, output={output_dir}"
    )

    started = time.perf_counter()
    last_progress = started
    matrix_count = 0
    correlation_count = 0
    skipped_count = 0
    skip_reason_counts = {}
    target_counts = []
    gene_counts = []
    generated_at = datetime.now(timezone.utc).isoformat()
    min_correlation_shared_genes = int_or_zero(metadata.get("min_shared_genes"))
    tasks = [
        (source_id, neighbors.get(source_id, []), args.skip_existing)
        for source_id in source_ids
    ]
    worker_count = min(args.workers, len(tasks))
    worker_args = (
        str(effects_dir),
        str(output_dir),
        str(work_dir),
        trait_ids,
        gene_ids,
        valid_counts,
        args.top_genes,
        args.top_targets,
        args.min_target_shared_genes,
        build_correlation,
        min_correlation_shared_genes,
        generated_at,
    )

    log(
        f"Using {worker_count} worker process{'es' if worker_count != 1 else ''}; "
        f"correlation={'enabled' if build_correlation else 'disabled'}"
    )

    def record_result(result: dict) -> None:
        nonlocal matrix_count
        nonlocal correlation_count
        nonlocal skipped_count

        matrix_count += int_or_zero(result.get("matrix_count"))
        correlation_count += int_or_zero(result.get("correlation_count"))
        skipped_count += int_or_zero(result.get("skipped_count"))

        if int_or_zero(result.get("matrix_count")) > 0 and result.get("target_count") is not None:
            target_counts.append(int_or_zero(result.get("target_count")))
        if int_or_zero(result.get("matrix_count")) > 0 and result.get("gene_count") is not None:
            gene_counts.append(int_or_zero(result.get("gene_count")))

        reason = result.get("skip_reason")
        if reason:
            skip_reason_counts[reason] = skip_reason_counts.get(reason, 0) + 1

    def maybe_log_progress(completed: int, force: bool = False) -> None:
        nonlocal last_progress

        now = time.perf_counter()
        if not force and now - last_progress < args.progress_seconds:
            return
        elapsed = now - started
        rate = completed / max(1.0, elapsed)
        remaining = len(tasks) - completed
        log(
            f"Sources {completed:,}/{len(tasks):,}; "
            f"matrix={matrix_count:,}; correlation={correlation_count:,}; "
            f"skipped={skipped_count:,}; "
            f"current average={rate:,.1f} sources/s; "
            f"remaining~{remaining / max(rate, 1e-9) / 60:.1f} min"
        )
        last_progress = now

    if worker_count == 1:
        init_source_worker(*worker_args)
        for completed, task in enumerate(tasks, start=1):
            record_result(build_source_payloads_worker(task))
            maybe_log_progress(completed, force=(completed == len(tasks)))
    else:
        completed = 0
        with ProcessPoolExecutor(
            max_workers=worker_count,
            initializer=init_source_worker,
            initargs=worker_args,
        ) as executor:
            futures = {
                executor.submit(build_source_payloads_worker, task): task[0]
                for task in tasks
            }
            for future in as_completed(futures):
                record_result(future.result())
                completed += 1
                maybe_log_progress(completed, force=(completed == len(tasks)))

    manifest = {
        "version": PRECOMPUTED_VERSION,
        "generatedAt": generated_at,
        "layout": "per_source_gzip_json",
        "method": "spearman",
        "effectColumn": "post_mean",
        "geneKey": "ensg_then_gene",
        "topGenes": args.top_genes,
        "topTargets": args.top_targets,
        "minTargetSharedGenes": args.min_target_shared_genes,
        "minCorrelationSharedGenes": min_correlation_shared_genes,
        "workers": worker_count,
        "sourceCount": len(source_ids),
        "matrixSourceCount": matrix_count,
        "correlationSourceCount": correlation_count,
        "skippedSourceCount": skipped_count,
        "skipReasonCounts": skip_reason_counts,
        "targetCountRange": {
            "min": min(target_counts) if target_counts else None,
            "max": max(target_counts) if target_counts else None,
        },
        "geneCountRange": {
            "min": min(gene_counts) if gene_counts else None,
            "max": max(gene_counts) if gene_counts else None,
        },
        "effectsDir": str(effects_dir),
        "neighborsFile": str(neighbors_file),
        "workDir": str(work_dir),
        "inputFingerprint": metadata.get("input_fingerprint"),
        "neighborInputFingerprint": neighbors_payload.get("input_fingerprint"),
    }
    write_json_atomic(output_dir / "manifest.json", manifest)
    log(
        f"Wrote manifest: matrix={matrix_count:,}, correlation={correlation_count:,}, "
        f"skipped={skipped_count:,}, elapsed={(time.perf_counter() - started) / 60:.1f} min"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("Interrupted")
        raise SystemExit(130)
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        raise SystemExit(1)
