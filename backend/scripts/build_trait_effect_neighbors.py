#!/usr/bin/env python3
"""Build exact Top-K Trait Effect Correlation neighbors from effect TSV files."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

# Pair workers sort rank vectors and should not each create a BLAS thread pool.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import numpy as np
from numpy.lib.format import open_memmap
from scipy.stats import rankdata


DEFAULT_EFFECTS_DIR = Path(
    "/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/"
    "outputs/cross_trait_heatmap/tables/effects"
)
DEFAULT_OUTPUT = DEFAULT_EFFECTS_DIR.parent.parent / "trait_effect_neighbors.json"
WORK_VERSION = 1

_WORKER_VALUES = None
_WORKER_VALID = None
_WORKER_NORMALIZED_RANKS = None
_WORKER_VALID_COUNTS = None
_WORKER_MIN_SHARED_GENES = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Calculate exact pairwise-complete Spearman correlations for Trait "
            "GeneBayes post_mean profiles and save each trait's nearest neighbors."
        )
    )
    parser.add_argument("--effects-dir", type=Path, default=DEFAULT_EFFECTS_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--work-dir", type=Path)
    parser.add_argument("--top-k", type=int, default=100)
    parser.add_argument("--min-shared-genes", type=int, default=100)
    parser.add_argument(
        "--workers",
        type=int,
        default=max(1, min(24, (os.cpu_count() or 2) - 2)),
    )
    parser.add_argument(
        "--max-traits",
        type=int,
        help="Use only the first N sorted effect files; intended for validation.",
    )
    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Discard compatible prepared matrices and rebuild them from TSV.",
    )
    parser.add_argument(
        "--cleanup-work-dir",
        action="store_true",
        help="Remove prepared matrices after the JSON is written successfully.",
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
    if args.top_k < 1:
        raise ValueError("--top-k must be positive")
    if args.min_shared_genes < 2:
        raise ValueError("--min-shared-genes must be at least 2")
    if args.workers < 1:
        raise ValueError("--workers must be positive")
    if args.max_traits is not None and args.max_traits < 2:
        raise ValueError("--max-traits must be at least 2")


def list_effect_files(effects_dir: Path, max_traits: int | None) -> list[Path]:
    if not effects_dir.is_dir():
        raise FileNotFoundError(f"Effect directory not found: {effects_dir}")

    files = sorted(effects_dir.glob("*.tsv"), key=lambda path: path.name)
    if max_traits is not None:
        files = files[:max_traits]
    if len(files) < 2:
        raise RuntimeError(f"At least two effect TSV files are required: {effects_dir}")
    return files


def build_input_fingerprint(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        stat = path.stat()
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(stat.st_size).encode("ascii"))
        digest.update(b"\0")
        digest.update(str(stat.st_mtime_ns).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def parse_effect_file(path: Path):
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
            gene_key = ""
            if ensg_index is not None:
                gene_key = fields[ensg_index].strip()
            if not gene_key and gene_index is not None:
                gene_key = fields[gene_index].strip()
            if not gene_key or gene_key in seen_genes:
                continue

            try:
                value = float(fields[value_index])
            except (TypeError, ValueError):
                continue
            if not math.isfinite(value):
                continue

            seen_genes.add(gene_key)
            yield gene_key, value


def metadata_matches(
    metadata_path: Path,
    fingerprint: str,
    trait_ids: list[str],
    min_shared_genes: int,
) -> bool:
    if not metadata_path.is_file():
        return False
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return (
        metadata.get("work_version") == WORK_VERSION
        and metadata.get("input_fingerprint") == fingerprint
        and metadata.get("trait_ids") == trait_ids
        and metadata.get("min_shared_genes") == min_shared_genes
    )


def write_json_atomic(path: Path, payload: object, *, compact: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    with temp_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(
            payload,
            handle,
            ensure_ascii=True,
            separators=(",", ":") if compact else None,
            indent=None if compact else 2,
        )
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp_path, path)


def prepare_matrices(
    files: list[Path],
    work_dir: Path,
    fingerprint: str,
    min_shared_genes: int,
    force_rebuild: bool,
) -> dict:
    trait_ids = [path.stem for path in files]
    metadata_path = work_dir / "metadata.json"
    values_path = work_dir / "values.npy"
    valid_path = work_dir / "valid.npy"
    ranks_path = work_dir / "normalized_ranks.npy"
    completed_path = work_dir / "completed_sources.npy"
    correlations_path = work_dir / "correlations.npy"
    shared_path = work_dir / "shared_genes.npy"

    required_paths = [
        values_path,
        valid_path,
        ranks_path,
        completed_path,
        correlations_path,
        shared_path,
    ]
    can_resume = (
        not force_rebuild
        and metadata_matches(
            metadata_path,
            fingerprint,
            trait_ids,
            min_shared_genes,
        )
        and all(path.is_file() for path in required_paths)
    )
    if can_resume:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        log(
            "Reusing prepared matrices: "
            f"{len(trait_ids)} traits, {len(metadata['gene_ids'])} genes"
        )
        return metadata

    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)

    log(f"Pass 1/2: collecting valid genes from {len(files)} effect TSV files")
    gene_ids = set()
    valid_counts = []
    started = time.perf_counter()
    for index, path in enumerate(files, start=1):
        count = 0
        for gene_key, _ in parse_effect_file(path):
            gene_ids.add(gene_key)
            count += 1
        valid_counts.append(count)
        if index % 100 == 0 or index == len(files):
            log(
                f"Gene scan {index}/{len(files)}; union={len(gene_ids):,}; "
                f"elapsed={time.perf_counter() - started:.1f}s"
            )

    sorted_gene_ids = sorted(gene_ids)
    gene_index = {gene_id: index for index, gene_id in enumerate(sorted_gene_ids)}
    trait_count = len(files)
    gene_count = len(sorted_gene_ids)

    values = open_memmap(
        values_path,
        mode="w+",
        dtype=np.float64,
        shape=(trait_count, gene_count),
    )
    values[:] = np.nan

    log(
        f"Pass 2/2: loading {trait_count:,} x {gene_count:,} effect matrix "
        f"({values.nbytes / (1024 ** 2):.1f} MiB)"
    )
    started = time.perf_counter()
    for row_index, path in enumerate(files):
        for gene_key, value in parse_effect_file(path):
            values[row_index, gene_index[gene_key]] = value
        if (row_index + 1) % 100 == 0 or row_index + 1 == trait_count:
            log(
                f"Matrix load {row_index + 1}/{trait_count}; "
                f"elapsed={time.perf_counter() - started:.1f}s"
            )
    values.flush()

    valid = open_memmap(
        valid_path,
        mode="w+",
        dtype=np.bool_,
        shape=(trait_count, gene_count),
    )
    valid[:] = np.isfinite(values)
    valid.flush()
    valid_counts_array = np.count_nonzero(valid, axis=1).astype(np.int32)

    normalized_ranks = open_memmap(
        ranks_path,
        mode="w+",
        dtype=np.float32,
        shape=(trait_count, gene_count),
    )
    normalized_ranks[:] = 0
    log("Precomputing complete-profile normalized ranks")
    for row_index in range(trait_count):
        row_valid = valid[row_index]
        count = int(valid_counts_array[row_index])
        if count < 2:
            continue
        ranks = rankdata(values[row_index, row_valid], method="average")
        ranks -= ranks.mean()
        norm = np.linalg.norm(ranks)
        if norm > 0:
            normalized_ranks[row_index, row_valid] = (ranks / norm).astype(np.float32)
    normalized_ranks.flush()

    correlations = open_memmap(
        correlations_path,
        mode="w+",
        dtype=np.float32,
        shape=(trait_count, trait_count),
    )
    correlations[:] = np.nan
    np.fill_diagonal(correlations, 1.0)
    correlations.flush()

    shared_genes = open_memmap(
        shared_path,
        mode="w+",
        dtype=np.uint32,
        shape=(trait_count, trait_count),
    )
    shared_genes[:] = 0
    shared_genes[np.diag_indices(trait_count)] = valid_counts_array.astype(np.uint32)
    shared_genes.flush()

    completed_sources = open_memmap(
        completed_path,
        mode="w+",
        dtype=np.bool_,
        shape=(trait_count,),
    )
    completed_sources[:] = False
    completed_sources[-1] = True
    completed_sources.flush()

    metadata = {
        "work_version": WORK_VERSION,
        "input_fingerprint": fingerprint,
        "effects_dir": str(files[0].parent.resolve()),
        "trait_ids": trait_ids,
        "gene_ids": sorted_gene_ids,
        "valid_counts": valid_counts_array.tolist(),
        "min_shared_genes": min_shared_genes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json_atomic(metadata_path, metadata, compact=True)
    log(
        f"Prepared matrices; valid genes per trait "
        f"{valid_counts_array.min():,}-{valid_counts_array.max():,}"
    )
    return metadata


def init_pair_worker(
    values_path: str,
    valid_path: str,
    ranks_path: str,
    valid_counts: list[int],
    min_shared_genes: int,
) -> None:
    global _WORKER_VALUES
    global _WORKER_VALID
    global _WORKER_NORMALIZED_RANKS
    global _WORKER_VALID_COUNTS
    global _WORKER_MIN_SHARED_GENES

    _WORKER_VALUES = np.load(values_path, mmap_mode="r")
    _WORKER_VALID = np.load(valid_path, mmap_mode="r")
    _WORKER_NORMALIZED_RANKS = np.load(ranks_path, mmap_mode="r")
    _WORKER_VALID_COUNTS = np.asarray(valid_counts, dtype=np.int32)
    _WORKER_MIN_SHARED_GENES = min_shared_genes


def normalized_subset_ranks(values: np.ndarray) -> np.ndarray | None:
    ranks = rankdata(values, method="average")
    ranks -= ranks.mean()
    norm = np.linalg.norm(ranks)
    if not math.isfinite(norm) or norm <= 0:
        return None
    return ranks / norm


def calculate_source_pairs(source_index: int):
    trait_count = _WORKER_VALUES.shape[0]
    target_indices = np.arange(source_index + 1, trait_count, dtype=np.int32)
    correlations = np.full(target_indices.size, np.nan, dtype=np.float32)
    shared_counts = np.zeros(target_indices.size, dtype=np.uint32)
    source_valid = _WORKER_VALID[source_index]
    source_valid_count = int(_WORKER_VALID_COUNTS[source_index])

    for result_index, target_index in enumerate(target_indices):
        shared = source_valid & _WORKER_VALID[target_index]
        shared_count = int(np.count_nonzero(shared))
        shared_counts[result_index] = shared_count
        if shared_count < _WORKER_MIN_SHARED_GENES:
            continue

        if shared_count == source_valid_count:
            source_ranks = _WORKER_NORMALIZED_RANKS[source_index, shared]
        else:
            source_ranks = normalized_subset_ranks(
                _WORKER_VALUES[source_index, shared]
            )

        target_valid_count = int(_WORKER_VALID_COUNTS[target_index])
        if shared_count == target_valid_count:
            target_ranks = _WORKER_NORMALIZED_RANKS[target_index, shared]
        else:
            target_ranks = normalized_subset_ranks(
                _WORKER_VALUES[target_index, shared]
            )

        if source_ranks is None or target_ranks is None:
            continue
        correlation = float(np.dot(source_ranks, target_ranks))
        if math.isfinite(correlation):
            correlations[result_index] = min(1.0, max(-1.0, correlation))

    return source_index, target_indices, correlations, shared_counts


def calculate_correlations(
    metadata: dict,
    work_dir: Path,
    workers: int,
    progress_seconds: float,
) -> None:
    trait_ids = metadata["trait_ids"]
    trait_count = len(trait_ids)
    values_path = work_dir / "values.npy"
    valid_path = work_dir / "valid.npy"
    ranks_path = work_dir / "normalized_ranks.npy"
    completed_path = work_dir / "completed_sources.npy"
    correlations_path = work_dir / "correlations.npy"
    shared_path = work_dir / "shared_genes.npy"

    completed = np.load(completed_path, mmap_mode="r+")
    correlations = np.load(correlations_path, mmap_mode="r+")
    shared_genes = np.load(shared_path, mmap_mode="r+")
    pending_sources = [
        index for index in range(trait_count - 1) if not bool(completed[index])
    ]
    if not pending_sources:
        log("All pairwise correlations are already complete")
        return

    total_pairs = trait_count * (trait_count - 1) // 2
    completed_pairs = sum(
        trait_count - source_index - 1
        for source_index in range(trait_count - 1)
        if bool(completed[source_index])
    )
    log(
        f"Calculating exact Spearman correlations for "
        f"{total_pairs - completed_pairs:,} remaining pairs with {workers} workers"
    )

    started = time.perf_counter()
    last_progress = started
    with ProcessPoolExecutor(
        max_workers=workers,
        initializer=init_pair_worker,
        initargs=(
            str(values_path),
            str(valid_path),
            str(ranks_path),
            metadata["valid_counts"],
            metadata["min_shared_genes"],
        ),
    ) as executor:
        futures = {
            executor.submit(calculate_source_pairs, source_index): source_index
            for source_index in pending_sources
        }
        for future in as_completed(futures):
            source_index, targets, scores, shared_counts = future.result()
            correlations[source_index, targets] = scores
            correlations[targets, source_index] = scores
            shared_genes[source_index, targets] = shared_counts
            shared_genes[targets, source_index] = shared_counts
            completed[source_index] = True
            completed_pairs += targets.size

            now = time.perf_counter()
            if (
                now - last_progress >= progress_seconds
                or completed_pairs == total_pairs
            ):
                correlations.flush()
                shared_genes.flush()
                completed.flush()
                elapsed = now - started
                rate = max(1.0, completed_pairs / max(1.0, elapsed))
                remaining = max(0, total_pairs - completed_pairs)
                log(
                    f"Pairs {completed_pairs:,}/{total_pairs:,} "
                    f"({completed_pairs / total_pairs:.1%}); "
                    f"current average={rate:,.0f} pairs/s; "
                    f"remaining~{remaining / rate / 60:.1f} min"
                )
                last_progress = now

    correlations.flush()
    shared_genes.flush()
    completed.flush()


def build_output_payload(
    metadata: dict,
    work_dir: Path,
    top_k: int,
) -> dict:
    trait_ids = metadata["trait_ids"]
    trait_count = len(trait_ids)
    correlations = np.load(work_dir / "correlations.npy", mmap_mode="r")
    shared_genes = np.load(work_dir / "shared_genes.npy", mmap_mode="r")
    trait_id_array = np.asarray(trait_ids, dtype=object)
    neighbors = {}
    neighbor_counts = []

    log(f"Selecting Top {top_k} neighbors for {trait_count} traits")
    for source_index, source_id in enumerate(trait_ids):
        scores = np.asarray(correlations[source_index], dtype=np.float64)
        valid = np.isfinite(scores)
        valid[source_index] = False
        valid &= shared_genes[source_index] >= metadata["min_shared_genes"]
        target_indices = np.flatnonzero(valid)
        if target_indices.size:
            order = np.lexsort(
                (
                    trait_id_array[target_indices],
                    -scores[target_indices],
                )
            )
            target_indices = target_indices[order[:top_k]]

        source_neighbors = []
        for target_index in target_indices:
            source_neighbors.append(
                {
                    "target_id": trait_ids[target_index],
                    "correlation": round(float(scores[target_index]), 8),
                    "shared_genes": int(shared_genes[source_index, target_index]),
                }
            )
        neighbors[source_id] = source_neighbors
        neighbor_counts.append(len(source_neighbors))

    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "spearman",
        "ranking": "correlation_desc",
        "effect_column": "post_mean",
        "gene_key": "ensg_then_gene",
        "pairwise_complete": True,
        "top_k": top_k,
        "min_shared_genes": metadata["min_shared_genes"],
        "trait_count": trait_count,
        "gene_union_count": len(metadata["gene_ids"]),
        "input_fingerprint": metadata["input_fingerprint"],
        "neighbor_count_range": {
            "min": min(neighbor_counts),
            "max": max(neighbor_counts),
        },
        "neighbors": neighbors,
    }


def main() -> int:
    args = parse_args()
    validate_args(args)
    files = list_effect_files(args.effects_dir.resolve(), args.max_traits)
    output = args.output.resolve()
    work_dir = (
        args.work_dir.resolve()
        if args.work_dir
        else output.parent / f".{output.stem}_work"
    )
    fingerprint = build_input_fingerprint(files)

    log(
        f"Starting Trait Effect Correlation neighbor build: "
        f"traits={len(files)}, top_k={args.top_k}, workers={args.workers}"
    )
    overall_started = time.perf_counter()
    metadata = prepare_matrices(
        files,
        work_dir,
        fingerprint,
        args.min_shared_genes,
        args.force_rebuild,
    )
    calculate_correlations(
        metadata,
        work_dir,
        min(args.workers, max(1, len(files) - 1)),
        args.progress_seconds,
    )
    payload = build_output_payload(metadata, work_dir, args.top_k)
    write_json_atomic(output, payload, compact=True)

    output_size = output.stat().st_size
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(f"{output.suffix}.sha256").write_text(
        f"{digest}  {output.name}\n",
        encoding="ascii",
    )
    log(
        f"Wrote {output} ({output_size / (1024 ** 2):.1f} MiB), "
        f"sha256={digest}"
    )
    log(f"Completed in {(time.perf_counter() - overall_started) / 60:.1f} minutes")

    if args.cleanup_work_dir:
        shutil.rmtree(work_dir)
        log(f"Removed work directory: {work_dir}")
    else:
        log(f"Resume data retained at: {work_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("Interrupted; completed source rows remain resumable in the work directory")
        raise SystemExit(130)
