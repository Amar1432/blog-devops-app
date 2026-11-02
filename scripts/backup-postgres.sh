#!/usr/bin/env bash
# ==============================================================================
# backup-postgres.sh — Automated PostgreSQL Backup with Verification & Retention
# ==============================================================================
# Usage:
#   ./scripts/backup-postgres.sh [OPTIONS]
#
# Options:
#   --dry-run       Preview backup and retention actions without deleting or writing files
#   --help          Show help message
#
# Environment variables (optional overrides):
#   BACKUP_DIR      Target directory (default: /opt/devops-blog/backups or ./backups)
#   RETENTION_DAYS  Number of days to keep backups (default: 7)
#   COMPOSE_FILE    Path to Compose file (default: /opt/devops-blog/deploy/compose.yaml or deploy/compose.yaml)
# ==============================================================================

set -euo pipefail

# Visual formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DRY_RUN=false
for arg in "$@"; do
    case "$arg" in
        --dry-run)
            DRY_RUN=true
            ;;
        --help)
            echo "Usage: $0 [--dry-run]"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

# Resolve paths safely
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Identify Compose file
if [ -n "${COMPOSE_FILE:-}" ] && [ -f "${COMPOSE_FILE}" ]; then
    COMPOSE_SPEC="${COMPOSE_FILE}"
elif [ -f "/opt/devops-blog/deploy/compose.yaml" ]; then
    COMPOSE_SPEC="/opt/devops-blog/deploy/compose.yaml"
elif [ -f "/opt/devops-blog/compose.yaml" ]; then
    COMPOSE_SPEC="/opt/devops-blog/compose.yaml"
elif [ -f "${REPO_DIR}/deploy/compose.yaml" ]; then
    COMPOSE_SPEC="${REPO_DIR}/deploy/compose.yaml"
elif [ -f "${REPO_DIR}/compose.yaml" ]; then
    COMPOSE_SPEC="${REPO_DIR}/compose.yaml"
else
    echo -e "${RED}[ERROR]${NC} Could not locate Docker Compose file." >&2
    exit 1
fi

COMPOSE_DIR="$(dirname "${COMPOSE_SPEC}")"

# Backup destination directory
BACKUP_DIR="${BACKUP_DIR:-/opt/devops-blog/backups}"
if [ ! -d "/opt/devops-blog" ] && [ "${BACKUP_DIR}" = "/opt/devops-blog/backups" ]; then
    BACKUP_DIR="${REPO_DIR}/backups"
fi

RETENTION_DAYS="${RETENTION_DAYS:-7}"

START_TIME=$(date +%s)
TIMESTAMP=$(date -u '+%Y%m%d_%H%M%SZ')
BACKUP_FILENAME="devops_blog_backup_${TIMESTAMP}.dump"
FINAL_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"
TMP_FILE="${FINAL_FILE}.tmp"
SHA_FILE="${FINAL_FILE}.sha256"

# Cleanup trap: if backup fails midway, delete the partial temporary file
cleanup_on_error() {
    if [ -f "${TMP_FILE}" ]; then
        echo -e "${YELLOW}[CLEANUP]${NC} Removing partial backup file: ${TMP_FILE}" >&2
        rm -f "${TMP_FILE}"
    fi
}
trap cleanup_on_error ERR EXIT

echo -e "${BOLD}=================================================================${NC}"
echo -e "${BOLD}   PostgreSQL Automated Backup — $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${BOLD}=================================================================${NC}"
echo "Compose Spec:   ${COMPOSE_SPEC}"
echo "Destination:    ${BACKUP_DIR}"
echo "Target File:    ${BACKUP_FILENAME}"
echo "Retention Cap:  ${RETENTION_DAYS} days"
if [ "${DRY_RUN}" = true ]; then
    echo -e "Mode:           ${YELLOW}DRY-RUN (No files will be written or deleted)${NC}"
fi

# Ensure backup directory exists with restrictive permissions (0700)
if [ "${DRY_RUN}" = false ]; then
    mkdir -p "${BACKUP_DIR}"
    chmod 0700 "${BACKUP_DIR}"
fi

# Check Docker and database container availability
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker CLI not found." >&2
    exit 1
fi

if ! docker compose -f "${COMPOSE_SPEC}" ps --status running -q db >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Database container is not running in Compose project." >&2
    exit 1
fi

if [ "${DRY_RUN}" = true ]; then
    echo -e "\n${YELLOW}[DRY-RUN]${NC} Would execute pg_dump -Fc inside container and stream to ${TMP_FILE}"
    echo -e "${YELLOW}[DRY-RUN]${NC} Would verify integrity with pg_restore --list"
    echo -e "${YELLOW}[DRY-RUN]${NC} Would generate checksum file ${SHA_FILE}"
else
    # 1. Execute pg_dump directly through container context (Zero credentials in process args)
    echo -e "\n[1/3] Streaming pg_dump (-Fc custom format) from container..."
    docker compose -f "${COMPOSE_SPEC}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${TMP_FILE}"

    # Verify that file has non-zero size
    if [ ! -s "${TMP_FILE}" ]; then
        echo -e "${RED}[ERROR]${NC} Generated backup file is empty!" >&2
        rm -f "${TMP_FILE}"
        exit 1
    fi

    # Set restrictive permissions (0600)
    chmod 0600 "${TMP_FILE}"

    # 2. Validate backup integrity before promoting to final file
    echo "[2/3] Verifying backup integrity via pg_restore --list..."
    if ! docker compose -f "${COMPOSE_SPEC}" exec -T db pg_restore --list < "${TMP_FILE}" >/dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} Backup integrity check failed! pg_restore could not read archive table of contents." >&2
        rm -f "${TMP_FILE}"
        exit 1
    fi

    # Promote temporary file to final backup file atomically
    mv "${TMP_FILE}" "${FINAL_FILE}"

    # Generate SHA-256 checksum for cryptographic verification
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "${BACKUP_DIR}" && sha256sum "${BACKUP_FILENAME}" > "${SHA_FILE}")
        chmod 0600 "${SHA_FILE}"
    elif command -v shasum >/dev/null 2>&1; then
        (cd "${BACKUP_DIR}" && shasum -a 256 "${BACKUP_FILENAME}" > "${SHA_FILE}")
        chmod 0600 "${SHA_FILE}"
    fi

    BACKUP_SIZE=$(ls -lh "${FINAL_FILE}" | awk '{print $5}')
    echo -e "${GREEN}[SUCCESS]${NC} Backup verified and stored: ${FINAL_FILE} (${BACKUP_SIZE})"
fi

# 3. Retention policy: Prune only matching backup files older than RETENTION_DAYS
echo -e "\n[3/3] Applying backup retention policy (${RETENTION_DAYS} days)..."
MATCHING_OLD_FILES=$(find "${BACKUP_DIR}" -maxdepth 1 -name "devops_blog_backup_*.dump" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true)

if [ -z "${MATCHING_OLD_FILES}" ]; then
    echo "No obsolete backup files found exceeding ${RETENTION_DAYS} days."
else
    for old_file in ${MATCHING_OLD_FILES}; do
        if [ "${DRY_RUN}" = true ]; then
            echo -e "${YELLOW}[DRY-RUN]${NC} Would remove expired backup: ${old_file}"
        else
            echo "Removing expired backup: ${old_file}"
            rm -f "${old_file}"
            rm -f "${old_file}.sha256"
        fi
    done
fi

END_TIME=$(date +%s)
DURATION=$(( END_TIME - START_TIME ))

# Disable the error trap because we succeeded
trap - ERR EXIT

echo -e "\n${BOLD}=================================================================${NC}"
echo -e "${GREEN}${BOLD}Backup process completed in ${DURATION}s.${NC}"
echo -e "${BOLD}=================================================================${NC}"
exit 0
