#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="$(cd -- "${BACKEND_DIR}/.." && pwd)"

CONDA_ENV="${CONDA_ENV:-Web-LoF}"
CONDA_SH="${CONDA_SH:-${HOME}/miniconda3/etc/profile.d/conda.sh}"
ARCHIVE_JOBS="${ARCHIVE_JOBS:-${SLURM_CPUS_PER_TASK:-4}}"

if [[ ! "${ARCHIVE_JOBS}" =~ ^[1-9][0-9]*$ ]]; then
    echo "ARCHIVE_JOBS must be a positive integer, got: ${ARCHIVE_JOBS}" >&2
    exit 2
fi

if [[ ! -f "${CONDA_SH}" ]]; then
    echo "Conda initialization script not found: ${CONDA_SH}" >&2
    exit 2
fi

# Each archive uses zlib level 9. Multiple independent archives are generated
# concurrently; libuv receives the same worker-pool size as the archive count.
export DATA_ARCHIVE_COMPRESSION_LEVEL="${DATA_ARCHIVE_COMPRESSION_LEVEL:-9}"
export DATA_ARCHIVE_JOBS="${ARCHIVE_JOBS}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-${ARCHIVE_JOBS}}"

source "${CONDA_SH}"
conda activate "${CONDA_ENV}"

mkdir -p "${PROJECT_DIR}/.runtime/logs"
LOCK_DIR="${PROJECT_DIR}/.runtime/data-archives.lock"
if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
    echo "Another archive preparation task appears to be running: ${LOCK_DIR}" >&2
    exit 3
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT INT TERM

cd "${BACKEND_DIR}"
echo "archive jobs=${ARCHIVE_JOBS}, compression=${DATA_ARCHIVE_COMPRESSION_LEVEL}, node=$(node -v)"
echo "log=${PROJECT_DIR}/.runtime/logs/data-archives-parallel.log"

npm run prepare:data-archives -- \
    --top-level \
    --jobs="${ARCHIVE_JOBS}" \
    "$@" 2>&1 | tee -a "${PROJECT_DIR}/.runtime/logs/data-archives-parallel.log"