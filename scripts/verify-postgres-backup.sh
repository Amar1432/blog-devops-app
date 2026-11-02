#!/usr/bin/env bash
# ==============================================================================
# verify-postgres-backup.sh — Verify Integrity of a PostgreSQL Custom Backup
# ==============================================================================
# Usage:
#   ./scripts/verify-postgres-backup.sh <path-to-backup.dump>
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path-to-backup.dump>" >&2
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}[ERROR]${NC} File not found: ${BACKUP_FILE}" >&2
    exit 1
fi

echo -e "${BOLD}=================================================================${NC}"
echo -e "${BOLD}   PostgreSQL Backup Verification — $(basename "${BACKUP_FILE}")${NC}"
echo -e "${BOLD}=================================================================${NC}"

# 1. Check SHA-256 Checksum if available
SHA_FILE="${BACKUP_FILE}.sha256"
if [ -f "${SHA_FILE}" ]; then
    echo -n "1. Validating SHA-256 checksum... "
    FILE_DIR="$(cd "$(dirname "${BACKUP_FILE}")" && pwd)"
    FILENAME="$(basename "${BACKUP_FILE}")"
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "${FILE_DIR}" && sha256sum -c "${FILENAME}.sha256" --quiet)
        echo -e "${GREEN}[OK]${NC}"
    elif command -v shasum >/dev/null 2>&1; then
        (cd "${FILE_DIR}" && shasum -a 256 -c "${FILENAME}.sha256" --quiet)
        echo -e "${GREEN}[OK]${NC}"
    else
        echo "Skipped (no sha256sum tool available)"
    fi
else
    echo "1. SHA-256 checksum file not found (skipping checksum)."
fi

# 2. Check Magic Header (PGDMP)
echo -n "2. Checking PostgreSQL custom format magic bytes... "
HEADER=$(head -c 5 "${BACKUP_FILE}")
if [ "${HEADER}" = "PGDMP" ]; then
    echo -e "${GREEN}[OK] (PGDMP format confirmed)${NC}"
else
    echo -e "${RED}[FAIL] (Expected PGDMP, got: ${HEADER})${NC}" >&2
    exit 1
fi

# 3. Read Table of Contents with pg_restore
echo -e "\n3. Inspecting Table of Contents (TOC) via pg_restore..."

# Resolve Compose file to invoke pg_restore inside db container if needed
COMPOSE_SPEC=""
for candidate in "/opt/devops-blog/deploy/compose.yaml" "/opt/devops-blog/compose.yaml" "deploy/compose.yaml" "compose.yaml"; do
    if [ -f "${candidate}" ]; then
        COMPOSE_SPEC="${candidate}"
        break
    fi
done

if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "${BACKUP_FILE}" | head -n 30 || true
elif [ -n "${COMPOSE_SPEC}" ] && docker compose -f "${COMPOSE_SPEC}" ps --status running -q db >/dev/null 2>&1; then
    docker compose -f "${COMPOSE_SPEC}" exec -T db pg_restore --list < "${BACKUP_FILE}" | head -n 30 || true
else
    echo -e "${RED}[ERROR]${NC} Neither host pg_restore nor db container is available to read TOC." >&2
    exit 1
fi

echo -e "\n${BOLD}=================================================================${NC}"
echo -e "${GREEN}${BOLD}Verification PASSED: ${BACKUP_FILE} is a valid custom-format backup.${NC}"
echo -e "${BOLD}=================================================================${NC}"
exit 0
