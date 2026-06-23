#!/usr/bin/env python3
"""Convert file-backed chart tables into JSON and precompressed JSON.

Each source directory receives an isolated ``json_precomputed`` subdirectory.
Source TSV/TXT files are opened read-only and are never renamed or modified.
Outputs are written to temporary files and atomically replaced only after a
complete conversion.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import zlib
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    import brotli
except ImportError:
    brotli = None


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATA_ROOT = Path(
    os.environ.get(
        "DATA_DIR",
        "/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs",
    )
)

DATASETS = {
    "manhattan": {
        "input_dir": Path(
            os.environ.get(
                "GWAS_MANHATTAN_DATA_DIR",
                DATA_ROOT / "gwas_manhattan" / "tables",
            )
        ),
        "suffixes": {".tsv"},
    },
    "burden-volcano": {
        "input_dir": Path(
            os.environ.get(
                "BURDEN_VOLCANO_DIR",
                DATA_ROOT / "burden_volcano" / "tables",
            )
        ),
        "suffixes": {".tsv"},
    },
    "posterior-volcano": {
        "input_dir": Path(
            os.environ.get(
                "POSTERIOR_VOLCANO_DIR",
                DATA_ROOT / "posterior_volcano" / "tables",
            )
        ),
        "suffixes": {".tsv"},
    },
    "program-scatter": {
        "input_dir": Path(
            os.environ.get(
                "PROGRAM_DATA_DIR",
                "/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/"
                "outputs/figures/cnmf/tables/program_regulator",
            )
        ),
        "suffixes": {".tsv"},
    },
    "trait-program-graph": {
        "input_dir": Path(
            os.environ.get(
                "TRAIT_PROGRAM_GENE_PANEL_DIR",
                DATA_ROOT / "trait_program_gene_panel" / "tables",
            )
        ),
        "suffixes": {".tsv"},
    },
    "regulation": {
        "input_dir": Path(
            os.environ.get(
                "REGULATION_DATA_DIR",
                "/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/"
                "outputs/perturbseq/cnmf_genomewide/cNMF_regulation/K562GW",
            )
        ),
        "suffixes": {".txt"},
    },
    "gene-level-scatter": {
        "input_dir": DATA_ROOT / "gene_level_scatter" / "tables",
        "suffixes": {".tsv"},
    },
    "gene-level-qq": {
        "input_dir": DATA_ROOT / "gene_level_qq" / "tables",
        "suffixes": {".tsv"},
    },
}

SCHEMA_VERSION = 2
DEFAULT_OUTPUT_SUBDIR = "json_precomputed"
READY_FILE_NAME = "_api_v2.ready"
MANHATTAN_NOTES = {
    "distance_to_gene": (
        "0 means the variant falls within the gene body; hundreds to thousands "
        "of bp is usually near; tens of thousands of bp or more is relatively distal."
    ),
    "variant": (
        "Use variant=hits for significant loci. Full mode applies server-side "
        "filters and returns all matching rows unless blocked by file-size limits."
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert chart TSV/TXT files into compact JSON and Brotli JSON "
            "without modifying the source files."
        )
    )
    parser.add_argument(
        "--dataset",
        action="append",
        choices=sorted(DATASETS),
        default=[],
        help="Dataset to convert. Repeat to select multiple; default is all.",
    )
    parser.add_argument(
        "--input-dir",
        action="append",
        default=[],
        metavar="DATASET=PATH",
        help="Override a dataset input directory. Can be repeated.",
    )
    parser.add_argument(
        "--output-subdir",
        default=DEFAULT_OUTPUT_SUBDIR,
        help="Subdirectory created inside each source directory.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=max(1, min(4, (os.cpu_count() or 2) - 1)),
    )
    parser.add_argument(
        "--brotli-quality",
        type=int,
        default=6,
        choices=range(0, 12),
        metavar="0-11",
    )
    parser.add_argument(
        "--no-brotli",
        action="store_true",
        help="Do not generate a Brotli JSON sidecar.",
    )
    parser.add_argument(
        "--no-gzip",
        action="store_true",
        help="Do not generate a gzip JSON fallback.",
    )
    parser.add_argument(
        "--compress-existing",
        action="store_true",
        help="Build missing/stale compression sidecars from existing JSON files.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild outputs even when they are newer than the source.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Convert at most N files per selected dataset.",
    )
    parser.add_argument(
        "--match",
        help="Only convert source filenames containing this text.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List planned work without creating directories or files.",
    )
    parser.add_argument(
        "--progress-seconds",
        type=float,
        default=10.0,
    )
    return parser.parse_args()


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def parse_input_overrides(values: Iterable[str]) -> dict[str, Path]:
    overrides: dict[str, Path] = {}
    for value in values:
        dataset, separator, raw_path = value.partition("=")
        if not separator or dataset not in DATASETS or not raw_path.strip():
            raise ValueError(f"Invalid --input-dir value: {value}")
        overrides[dataset] = Path(raw_path).expanduser()
    return overrides


def validate_args(args: argparse.Namespace) -> None:
    if args.workers < 1:
        raise ValueError("--workers must be positive")
    if args.limit is not None and args.limit < 1:
        raise ValueError("--limit must be positive")
    if not args.output_subdir or Path(args.output_subdir).name != args.output_subdir:
        raise ValueError("--output-subdir must be one directory name")
    if not args.dry_run and not args.no_brotli and brotli is None:
        raise RuntimeError(
            "The Python brotli package is required unless --no-brotli is used"
        )


def read_header(handle, source_path: Path) -> list[str]:
    line = handle.readline()
    if not line:
        return []
    headers = line.rstrip("\r\n").split("\t")
    headers = [value.lstrip("\ufeff").strip() for value in headers]
    if not all(headers):
        raise ValueError(f"Empty TSV column name: {source_path}")
    return headers


def iter_raw_rows(handle, headers: list[str]) -> Iterable[dict[str, str]]:
    for line in handle:
        columns = line.rstrip("\r\n").split("\t")
        yield {
            header: (columns[index] if index < len(columns) else "").strip()
            for index, header in enumerate(headers)
        }


def optional_number(value: object) -> float | int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if not math.isfinite(number):
        return None
    if number.is_integer() and not any(char in text.lower() for char in (".", "e")):
        return int(number)
    return number


def parse_delimited_values(value: object) -> list[str]:
    return [part.strip() for part in str(value or "").split(";") if part.strip()]


def distance_bucket(distance: float | int | None) -> str:
    if distance is None:
        return "unknown"
    absolute = abs(distance)
    if absolute == 0:
        return "in_gene"
    if absolute <= 5000:
        return "near"
    if absolute <= 50000:
        return "moderate"
    return "distal"


def normalize_manhattan_row(row: dict[str, str]) -> dict | None:
    chromosome = str(row.get("chr") or "").strip()
    bp = optional_number(row.get("bp"))
    p_value = optional_number(row.get("p"))
    if not chromosome or bp is None or p_value is None:
        return None

    logp = optional_number(row.get("logp"))
    if logp is None and p_value > 0:
        logp = -math.log10(p_value)
    distance = optional_number(row.get("distance_to_gene"))
    programs = parse_delimited_values(row.get("program"))
    genesets = parse_delimited_values(row.get("geneset"))

    return {
        "chr": chromosome,
        "bp": bp,
        "snp": str(row.get("snp") or "").strip(),
        "p": p_value,
        "logp": logp,
        "nearestGene": str(row.get("nearest_gene") or "").strip(),
        "distanceToGene": distance,
        "distanceBucket": distance_bucket(distance),
        "program": str(row.get("program") or "").strip(),
        "programs": programs,
        "geneset": str(row.get("geneset") or "").strip(),
        "genesets": genesets,
        "primaryProgram": programs[0] if programs else "",
        "primaryGeneset": genesets[0] if genesets else "",
        "hasProgram": bool(programs),
        "hasGeneset": bool(genesets),
    }


def file_identity(dataset: str, source_path: Path) -> dict:
    stem = source_path.stem
    identity = {"fileId": stem, "variant": None, "part": None}

    if dataset == "manhattan":
        match = re.match(r"^(.+)_gwas_(hits|variants)$", stem, flags=re.IGNORECASE)
        if match:
            identity["fileId"] = match.group(1)
            identity["variant"] = "hits" if match.group(2).lower() == "hits" else "full"
    elif dataset in {"burden-volcano", "posterior-volcano"}:
        match = re.match(r"^(.+)_(hits|genes)$", stem, flags=re.IGNORECASE)
        if match:
            identity["fileId"] = match.group(1)
            identity["variant"] = "hits" if match.group(2).lower() == "hits" else "full"
    elif dataset == "trait-program-graph":
        match = re.match(r"^(.+)_(programs|long)$", stem, flags=re.IGNORECASE)
        if match:
            identity["fileId"] = match.group(1)
            identity["part"] = "programs" if match.group(2).lower() == "programs" else "genes"
    elif dataset == "regulation":
        match = re.search(r"program(\d+)", stem, flags=re.IGNORECASE)
        if match:
            identity["fileId"] = match.group(1)

    return identity


def variant_availability(dataset: str, source_path: Path, file_id: str) -> dict:
    if dataset == "manhattan":
        return {
            "hits": (source_path.parent / f"{file_id}_gwas_hits.tsv").is_file(),
            "full": (source_path.parent / f"{file_id}_gwas_variants.tsv").is_file(),
        }
    if dataset in {"burden-volcano", "posterior-volcano"}:
        return {
            "hits": (source_path.parent / f"{file_id}_hits.tsv").is_file(),
            "full": (source_path.parent / f"{file_id}_genes.tsv").is_file(),
        }
    return {}


def build_prefix(
    dataset: str,
    source_path: Path,
    source_stat: os.stat_result,
    columns: list[str],
) -> dict:
    identity = file_identity(dataset, source_path)
    file_id = identity["fileId"]
    variant = identity["variant"]

    if dataset == "manhattan":
        return {
            "fileId": file_id,
            "variant": variant,
            "requestedVariant": variant,
            "resolvedVariant": variant,
            "fallbackUsed": False,
            "autoFullApplied": False,
            "autoFullThreshold": 0,
            "autoFullPointCount": None,
            "fileName": source_path.name,
            "availableVariants": variant_availability(dataset, source_path, file_id),
            "truncated": False,
            "rowLimit": None,
            "fileSize": source_stat.st_size,
            "sampling": "all",
            "filters": {
                "chromosomes": [],
                "minLogP": None,
                "programs": [],
                "genesets": [],
            },
        }

    if dataset in {"burden-volcano", "posterior-volcano"}:
        volcano_type = "burden" if dataset == "burden-volcano" else "posterior"
        return {
            "fileId": file_id,
            "volcanoType": volcano_type,
            "effectField": "beta" if volcano_type == "burden" else "post_mean",
            "variant": variant,
            "requestedVariant": variant,
            "resolvedVariant": variant,
            "fallbackUsed": False,
            "fileName": source_path.name,
            "availableVariants": variant_availability(dataset, source_path, file_id),
        }

    if dataset == "regulation":
        return {
            "fileName": source_path.name,
        }

    if dataset == "trait-program-graph":
        return {
            "fileId": file_id,
            "part": identity["part"],
            "fileName": source_path.name,
        }

    return {
        "fileId": file_id,
        "fileName": source_path.name,
    }


class Summary:
    def __init__(self, dataset: str) -> None:
        self.dataset = dataset
        self.with_program = 0
        self.with_geneset = 0
        self.distance = {
            "in_gene": 0,
            "near": 0,
            "moderate": 0,
            "distal": 0,
            "unknown": 0,
        }
        self.program_counts: dict[str, int] = {}
        self.geneset_counts: dict[str, int] = {}
        self.positive = 0
        self.negative = 0

    @staticmethod
    def increment(counter: dict[str, int], values: Iterable[str]) -> None:
        for value in values:
            counter[value] = counter.get(value, 0) + 1

    def add(self, row: dict) -> None:
        if self.dataset == "manhattan":
            if row["hasProgram"]:
                self.with_program += 1
            if row["hasGeneset"]:
                self.with_geneset += 1
            self.distance[row["distanceBucket"]] += 1
            self.increment(self.program_counts, row["programs"])
            self.increment(self.geneset_counts, row["genesets"])
            return

        if self.dataset in {"burden-volcano", "posterior-volcano"}:
            field = "beta" if self.dataset == "burden-volcano" else "post_mean"
            effect = optional_number(row.get(field))
            if effect is not None:
                if effect >= 0:
                    self.positive += 1
                else:
                    self.negative += 1
            if str(row.get("program") or "").strip():
                self.with_program += 1
            if str(row.get("geneset") or "").strip():
                self.with_geneset += 1

    @staticmethod
    def top_counts(counter: dict[str, int]) -> list[dict]:
        ordered = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
        return [{"name": name, "count": count} for name, count in ordered[:20]]

    def finish(self, row_count: int) -> dict | None:
        if self.dataset == "manhattan":
            return {
                "totalRows": row_count,
                "withProgram": self.with_program,
                "withGeneset": self.with_geneset,
                "withoutProgram": row_count - self.with_program,
                "withoutGeneset": row_count - self.with_geneset,
                "distanceBuckets": self.distance,
                "topPrograms": self.top_counts(self.program_counts),
                "topGenesets": self.top_counts(self.geneset_counts),
            }
        if self.dataset in {"burden-volcano", "posterior-volcano"}:
            return {
                "totalRows": row_count,
                "positive": self.positive,
                "negative": self.negative,
                "annotatedProgram": self.with_program,
                "annotatedGeneset": self.with_geneset,
            }
        return None


class AtomicJsonWriter:
    def __init__(
        self,
        json_path: Path,
        brotli_path: Path | None,
        gzip_path: Path | None,
        quality: int,
    ) -> None:
        suffix = f".tmp-{os.getpid()}"
        self.json_path = json_path
        self.brotli_path = brotli_path
        self.gzip_path = gzip_path
        self.json_temp = Path(f"{json_path}{suffix}")
        self.brotli_temp = Path(f"{brotli_path}{suffix}") if brotli_path else None
        self.gzip_temp = Path(f"{gzip_path}{suffix}") if gzip_path else None
        self.json_handle = self.json_temp.open("wb")
        self.brotli_handle = self.brotli_temp.open("wb") if self.brotli_temp else None
        self.gzip_handle = self.gzip_temp.open("wb") if self.gzip_temp else None
        self.compressor = (
            brotli.Compressor(quality=quality, mode=brotli.MODE_TEXT)
            if self.brotli_handle
            else None
        )
        self.gzip_compressor = (
            zlib.compressobj(level=6, method=zlib.DEFLATED, wbits=31)
            if self.gzip_handle
            else None
        )
        self.closed = False

    def write(self, value: str | bytes) -> None:
        data = value.encode("utf-8") if isinstance(value, str) else value
        self.json_handle.write(data)
        if self.compressor:
            compressed = self.compressor.process(data)
            if compressed:
                self.brotli_handle.write(compressed)
        if self.gzip_compressor:
            compressed = self.gzip_compressor.compress(data)
            if compressed:
                self.gzip_handle.write(compressed)

    def commit(self) -> None:
        if self.closed:
            return
        if self.compressor:
            final_chunk = self.compressor.finish()
            if final_chunk:
                self.brotli_handle.write(final_chunk)
        if self.gzip_compressor:
            final_chunk = self.gzip_compressor.flush(zlib.Z_FINISH)
            if final_chunk:
                self.gzip_handle.write(final_chunk)
        self.json_handle.close()
        if self.brotli_handle:
            self.brotli_handle.close()
        if self.gzip_handle:
            self.gzip_handle.close()
        os.replace(self.json_temp, self.json_path)
        if self.brotli_temp and self.brotli_path:
            os.replace(self.brotli_temp, self.brotli_path)
        if self.gzip_temp and self.gzip_path:
            os.replace(self.gzip_temp, self.gzip_path)
        self.closed = True

    def abort(self) -> None:
        if self.closed:
            return
        self.json_handle.close()
        if self.brotli_handle:
            self.brotli_handle.close()
        if self.gzip_handle:
            self.gzip_handle.close()
        self.json_temp.unlink(missing_ok=True)
        if self.brotli_temp:
            self.brotli_temp.unlink(missing_ok=True)
        if self.gzip_temp:
            self.gzip_temp.unlink(missing_ok=True)
        self.closed = True


def json_fragment(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def manhattan_row_key(row: dict) -> str:
    return f"{row.get('chr', '')}:{row.get('bp', '')}:{row.get('snp', '')}"


def load_manhattan_hits(source_path: Path) -> list[dict]:
    identity = file_identity("manhattan", source_path)
    if identity["variant"] != "full":
        return []

    hits_path = source_path.parent / f"{identity['fileId']}_gwas_hits.tsv"
    if not hits_path.is_file():
        return []

    rows = []
    with hits_path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        headers = read_header(handle, hits_path)
        for raw_row in iter_raw_rows(handle, headers):
            row = normalize_manhattan_row(raw_row)
            if row is not None:
                rows.append(row)
    return rows


def freshness_dependency_paths(dataset: str, source_path: Path) -> list[Path]:
    identity = file_identity(dataset, source_path)
    if dataset == "manhattan" and identity["variant"] == "full":
        return [source_path.parent / f"{identity['fileId']}_gwas_hits.tsv"]
    if dataset in {"burden-volcano", "posterior-volcano"} and identity["variant"] == "full":
        return [source_path.parent / f"{identity['fileId']}_hits.tsv"]
    return []


def outputs_are_fresh(
    source_path: Path,
    json_path: Path,
    brotli_path: Path | None,
    gzip_path: Path | None,
    dependency_paths: list[Path] | None = None,
) -> bool:
    required = (
        [json_path]
        + ([brotli_path] if brotli_path else [])
        + ([gzip_path] if gzip_path else [])
    )
    source_mtime = max(
        [source_path.stat().st_mtime_ns]
        + [
            path.stat().st_mtime_ns
            for path in (dependency_paths or [])
            if path.is_file()
        ]
    )
    return all(
        path
        and path.is_file()
        and path.stat().st_size > 0
        and path.stat().st_mtime_ns >= source_mtime
        for path in required
    )


def sidecar_is_fresh(json_path: Path, sidecar_path: Path | None) -> bool:
    return bool(
        sidecar_path
        and sidecar_path.is_file()
        and sidecar_path.stat().st_size > 0
        and sidecar_path.stat().st_mtime_ns >= json_path.stat().st_mtime_ns
    )


def compress_existing_json(
    job: dict,
    source_path: Path,
    json_path: Path,
    brotli_path: Path | None,
    gzip_path: Path | None,
) -> dict:
    if not json_path.is_file():
        raise FileNotFoundError(f"Missing existing JSON: {json_path}")

    build_brotli = bool(
        brotli_path
        and (job["force"] or not sidecar_is_fresh(json_path, brotli_path))
    )
    build_gzip = bool(
        gzip_path
        and (job["force"] or not sidecar_is_fresh(json_path, gzip_path))
    )
    if not build_brotli and not build_gzip:
        return {
            "dataset": job["dataset"],
            "source": source_path.name,
            "status": "skipped",
            "rows": None,
            "sourceBytes": source_path.stat().st_size,
            "jsonBytes": json_path.stat().st_size,
            "brotliBytes": brotli_path.stat().st_size if brotli_path else 0,
            "gzipBytes": gzip_path.stat().st_size if gzip_path else 0,
            "durationSeconds": 0,
        }

    started = time.monotonic()
    suffix = f".tmp-{os.getpid()}"
    brotli_temp = Path(f"{brotli_path}{suffix}") if build_brotli else None
    gzip_temp = Path(f"{gzip_path}{suffix}") if build_gzip else None
    brotli_handle = brotli_temp.open("wb") if brotli_temp else None
    gzip_handle = gzip_temp.open("wb") if gzip_temp else None
    brotli_compressor = (
        brotli.Compressor(quality=job["brotli_quality"], mode=brotli.MODE_TEXT)
        if brotli_handle
        else None
    )
    gzip_compressor = (
        zlib.compressobj(level=6, method=zlib.DEFLATED, wbits=31)
        if gzip_handle
        else None
    )

    try:
        with json_path.open("rb") as source_handle:
            while True:
                chunk = source_handle.read(1024 * 1024)
                if not chunk:
                    break
                if brotli_compressor:
                    compressed = brotli_compressor.process(chunk)
                    if compressed:
                        brotli_handle.write(compressed)
                if gzip_compressor:
                    compressed = gzip_compressor.compress(chunk)
                    if compressed:
                        gzip_handle.write(compressed)

        if brotli_compressor:
            compressed = brotli_compressor.finish()
            if compressed:
                brotli_handle.write(compressed)
        if gzip_compressor:
            compressed = gzip_compressor.flush(zlib.Z_FINISH)
            if compressed:
                gzip_handle.write(compressed)
        if brotli_handle:
            brotli_handle.close()
            os.replace(brotli_temp, brotli_path)
        if gzip_handle:
            gzip_handle.close()
            os.replace(gzip_temp, gzip_path)
    except BaseException:
        if brotli_handle and not brotli_handle.closed:
            brotli_handle.close()
        if gzip_handle and not gzip_handle.closed:
            gzip_handle.close()
        if brotli_temp:
            brotli_temp.unlink(missing_ok=True)
        if gzip_temp:
            gzip_temp.unlink(missing_ok=True)
        raise

    return {
        "dataset": job["dataset"],
        "source": source_path.name,
        "status": "converted",
        "rows": None,
        "sourceBytes": source_path.stat().st_size,
        "jsonBytes": json_path.stat().st_size,
        "brotliBytes": brotli_path.stat().st_size if brotli_path else 0,
        "gzipBytes": gzip_path.stat().st_size if gzip_path else 0,
        "durationSeconds": round(time.monotonic() - started, 3),
    }


def convert_job(job: dict) -> dict:
    dataset = job["dataset"]
    source_path = Path(job["source"])
    output_dir = Path(job["output_dir"])
    json_path = output_dir / f"{source_path.stem}.json"
    brotli_path = None if job["no_brotli"] else Path(f"{json_path}.br")
    gzip_path = None if job["no_gzip"] else Path(f"{json_path}.gz")

    if job["compress_existing"]:
        return compress_existing_json(job, source_path, json_path, brotli_path, gzip_path)

    if not job["force"] and outputs_are_fresh(
        source_path,
        json_path,
        brotli_path,
        gzip_path,
        freshness_dependency_paths(dataset, source_path),
    ):
        return {
            "dataset": dataset,
            "source": source_path.name,
            "status": "skipped",
            "rows": None,
            "sourceBytes": source_path.stat().st_size,
            "jsonBytes": json_path.stat().st_size,
            "brotliBytes": brotli_path.stat().st_size if brotli_path else 0,
            "gzipBytes": gzip_path.stat().st_size if gzip_path else 0,
            "durationSeconds": 0,
        }

    started = time.monotonic()
    source_stat = source_path.stat()
    writer = AtomicJsonWriter(
        json_path,
        brotli_path,
        gzip_path,
        job["brotli_quality"],
    )
    row_count = 0
    source_row_count = 0
    filtered_row_count = 0
    summary = Summary(dataset)

    try:
        with source_path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            headers = read_header(handle, source_path)
            prefix = build_prefix(dataset, source_path, source_stat, headers)
            writer.write("{")
            for index, (key, value) in enumerate(prefix.items()):
                if index:
                    writer.write(",")
                writer.write(f"{json_fragment(key)}:{json_fragment(value)}")
            if prefix:
                writer.write(",")
            writer.write('"data":[')

            first = True
            hit_rows = load_manhattan_hits(source_path) if dataset == "manhattan" else []
            seen = set()

            for row in hit_rows:
                key = manhattan_row_key(row)
                if key in seen:
                    continue
                seen.add(key)
                if not first:
                    writer.write(",")
                writer.write(json_fragment(row))
                first = False
                row_count += 1
                summary.add(row)

            for raw_row in iter_raw_rows(handle, headers):
                source_row_count += 1
                row = normalize_manhattan_row(raw_row) if dataset == "manhattan" else raw_row
                if row is None:
                    continue
                filtered_row_count += 1
                if hit_rows:
                    key = manhattan_row_key(row)
                    if key in seen:
                        continue
                    seen.add(key)
                if not first:
                    writer.write(",")
                writer.write(json_fragment(row))
                first = False
                row_count += 1
                summary.add(row)

            final_summary = summary.finish(row_count)
            writer.write("]")
            if dataset == "manhattan":
                writer.write(f',"hasData":{json_fragment(row_count > 0)}')
                writer.write(f',"sourceRowCount":{source_row_count}')
                writer.write(f',"filteredRowCount":{filtered_row_count}')
                writer.write(f',"returnedRowCount":{row_count}')
                writer.write(f',"summary":{json_fragment(final_summary)}')
                writer.write(f',"notes":{json_fragment(MANHATTAN_NOTES)}')
            elif dataset in {"burden-volcano", "posterior-volcano"}:
                writer.write(f',"hasData":{json_fragment(row_count > 0)}')
                writer.write(f',"summary":{json_fragment(final_summary)}')
            writer.write("}\n")

        writer.commit()
    except BaseException:
        writer.abort()
        raise

    return {
        "dataset": dataset,
        "source": source_path.name,
        "status": "converted",
        "rows": row_count,
        "sourceBytes": source_stat.st_size,
        "jsonBytes": json_path.stat().st_size,
        "brotliBytes": brotli_path.stat().st_size if brotli_path else 0,
        "gzipBytes": gzip_path.stat().st_size if gzip_path else 0,
        "durationSeconds": round(time.monotonic() - started, 3),
    }


def discover_jobs(args: argparse.Namespace) -> tuple[list[dict], dict[str, Path]]:
    overrides = parse_input_overrides(args.input_dir)
    selected = args.dataset or list(DATASETS)
    jobs: list[dict] = []
    output_dirs: dict[str, Path] = {}

    for dataset in selected:
        definition = DATASETS[dataset]
        input_dir = overrides.get(dataset, definition["input_dir"]).resolve()
        if not input_dir.is_dir():
            log(f"{dataset}: input directory is missing, skipping: {input_dir}")
            continue

        output_dir = input_dir / args.output_subdir
        output_dirs[dataset] = output_dir
        sources = sorted(
            path
            for path in input_dir.iterdir()
            if path.is_file()
            and path.suffix.lower() in definition["suffixes"]
            and (not args.match or args.match.lower() in path.name.lower())
        )
        if args.limit is not None:
            sources = sources[: args.limit]

        for source_path in sources:
            jobs.append(
                {
                    "dataset": dataset,
                    "source": str(source_path),
                    "output_dir": str(output_dir),
                    "brotli_quality": args.brotli_quality,
                    "no_brotli": args.no_brotli,
                    "no_gzip": args.no_gzip,
                    "compress_existing": args.compress_existing,
                    "force": args.force,
                }
            )
        log(f"{dataset}: discovered {len(sources)} source files in {input_dir}")

    return jobs, output_dirs


def write_manifests(output_dirs: dict[str, Path], results: list[dict], args: argparse.Namespace) -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    for dataset, output_dir in output_dirs.items():
        dataset_results = [result for result in results if result["dataset"] == dataset]
        json_files = [
            path
            for path in output_dir.glob("*.json")
            if path.name != "_manifest.json"
        ]
        brotli_files = list(output_dir.glob("*.json.br"))
        gzip_files = list(output_dir.glob("*.json.gz"))
        payload = {
            "schemaVersion": SCHEMA_VERSION,
            "dataset": dataset,
            "generatedAt": generated_at,
            "outputDirectory": str(output_dir),
            "brotliQuality": None if args.no_brotli else args.brotli_quality,
            "outputFiles": {
                "json": len(json_files),
                "brotli": len(brotli_files),
                "gzip": len(gzip_files),
            },
            "outputBytes": {
                "json": sum(path.stat().st_size for path in json_files),
                "brotli": sum(path.stat().st_size for path in brotli_files),
                "gzip": sum(path.stat().st_size for path in gzip_files),
            },
            "lastRun": {
                "converted": sum(result["status"] == "converted" for result in dataset_results),
                "skipped": sum(result["status"] == "skipped" for result in dataset_results),
                "failed": sum(result["status"] == "failed" for result in dataset_results),
                "sourceBytes": sum(result.get("sourceBytes", 0) for result in dataset_results),
                "jsonBytes": sum(result.get("jsonBytes", 0) for result in dataset_results),
                "brotliBytes": sum(result.get("brotliBytes", 0) for result in dataset_results),
                "gzipBytes": sum(result.get("gzipBytes", 0) for result in dataset_results),
            },
        }
        temp_path = output_dir / f"_manifest.json.tmp-{os.getpid()}"
        manifest_path = output_dir / "_manifest.json"
        temp_path.write_text(
            f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n",
            encoding="utf-8",
        )
        os.replace(temp_path, manifest_path)


def write_ready_files(output_dirs: dict[str, Path]) -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    for dataset, output_dir in output_dirs.items():
        ready_path = output_dir / READY_FILE_NAME
        temp_path = output_dir / f"{READY_FILE_NAME}.tmp-{os.getpid()}"
        temp_path.write_text(
            f"{json.dumps({
                'schemaVersion': SCHEMA_VERSION,
                'dataset': dataset,
                'generatedAt': generated_at,
            }, ensure_ascii=False, separators=(',', ':'))}\n",
            encoding="utf-8",
        )
        os.replace(temp_path, ready_path)


def main() -> int:
    args = parse_args()
    validate_args(args)
    jobs, output_dirs = discover_jobs(args)

    if not jobs:
        log("No matching source files")
        return 0

    if args.dry_run:
        for dataset, output_dir in output_dirs.items():
            count = sum(job["dataset"] == dataset for job in jobs)
            log(f"dry-run: {dataset}: {count} files -> {output_dir}")
        return 0

    for output_dir in output_dirs.values():
        output_dir.mkdir(parents=False, exist_ok=True)

    started = time.monotonic()
    last_progress = 0.0
    results: list[dict] = []
    failures = 0

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        future_jobs = {executor.submit(convert_job, job): job for job in jobs}
        for completed, future in enumerate(as_completed(future_jobs), start=1):
            job = future_jobs[future]
            try:
                result = future.result()
            except BaseException as error:
                failures += 1
                result = {
                    "dataset": job["dataset"],
                    "source": Path(job["source"]).name,
                    "status": "failed",
                    "error": str(error),
                    "sourceBytes": Path(job["source"]).stat().st_size,
                    "jsonBytes": 0,
                    "brotliBytes": 0,
                    "gzipBytes": 0,
                }
                log(f"FAILED {result['dataset']}/{result['source']}: {error}")
            results.append(result)

            now = time.monotonic()
            if (
                completed == len(jobs)
                or now - last_progress >= args.progress_seconds
            ):
                converted = sum(item["status"] == "converted" for item in results)
                skipped = sum(item["status"] == "skipped" for item in results)
                log(
                    f"progress {completed}/{len(jobs)} "
                    f"converted={converted} skipped={skipped} failed={failures}"
                )
                last_progress = now

    write_manifests(output_dirs, results, args)
    if failures == 0:
        write_ready_files(output_dirs)
    duration = time.monotonic() - started
    source_bytes = sum(result.get("sourceBytes", 0) for result in results)
    json_bytes = sum(result.get("jsonBytes", 0) for result in results)
    brotli_bytes = sum(result.get("brotliBytes", 0) for result in results)
    gzip_bytes = sum(result.get("gzipBytes", 0) for result in results)
    log(
        "complete "
        f"files={len(results)} failed={failures} duration={duration:.1f}s "
        f"source={source_bytes} json={json_bytes} "
        f"brotli={brotli_bytes} gzip={gzip_bytes}"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("Interrupted")
        raise SystemExit(130)
