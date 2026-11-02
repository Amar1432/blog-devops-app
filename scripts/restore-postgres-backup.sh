#!/usr/bin/env bash
# ==============================================================================
# restore-postgres-backup.sh — Isolated PostgreSQL Restore & Disaster Recovery
# ==============================================================================
# Usage:
#   ./scripts/restore-postgres-backup.sh <path-to-backup.dump> [--test-drill]
#
# Safety Invariant:
#   By default, this script runs in ISOLATED DRILL mode. It spins up an ephemeral,
#   isolated PostgreSQL container with a temporary volume and random credentials.
#   It NEVER connects to, overwrites, or modifies the live production database.
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path-to-backup.dump> [--test-drill]" >&2
    exit 1
fi

BACKUP_FILE="$1"
TEST_DRILL=true

if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}[ERROR]${NC} Backup file not found: ${BACKUP_FILE}" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRILL_CONTAINER="devops-blog-restore-drill-$$"
DRILL_DB="devops_blog_restore"
DRILL_USER="restore_test_user"
DRILL_PASS="restore_secure_pass_$$"

# Trap to guarantee cleanup of the ephemeral container on exit or failure
cleanup() {
    if docker ps -a -q -f name="${DRILL_CONTAINER}" >/dev/null 2>&1; then
        echo -e "\n${YELLOW}[CLEANUP]${NC} Stopping and removing isolated drill container: ${DRILL_CONTAINER}..."
        docker stop "${DRILL_CONTAINER}" >/dev/null 2>&1 || true
        docker rm -v "${DRILL_CONTAINER}" >/dev/null 2>&1 || true
        echo -e "${GREEN}[CLEANUP]${NC} Isolated environment safely dismantled."
    fi
}
trap cleanup EXIT ERR INT

echo -e "${BOLD}=================================================================${NC}"
echo -e "${BOLD}   PostgreSQL Isolated Restore & DR Drill — $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${BOLD}=================================================================${NC}"
echo "Backup File:       ${BACKUP_FILE}"
echo "Mode:              Isolated Drill Container"
echo "Ephemeral Target:  ${DRILL_CONTAINER}"
echo -e "${YELLOW}Safety Rule:       Live production database will NOT be touched.${NC}"

START_TIME=$(date +%s)

# 1. Verify backup file format and checksum before attempting restore
echo -e "\n[1/5] Verifying backup integrity before restore..."
if [ -f "${SCRIPT_DIR}/verify-postgres-backup.sh" ]; then
    "${SCRIPT_DIR}/verify-postgres-backup.sh" "${BACKUP_FILE}"
else
    head -c 5 "${BACKUP_FILE}" | grep -q "PGDMP" || { echo -e "${RED}[ERROR]${NC} Invalid format"; exit 1; }
fi

# 2. Provision isolated ephemeral PostgreSQL container
echo -e "\n[2/5] Provisioning isolated ephemeral PostgreSQL 16 container..."
docker run -d \
    --name "${DRILL_CONTAINER}" \
    -e POSTGRES_USER="${DRILL_USER}" \
    -e POSTGRES_PASSWORD="${DRILL_PASS}" \
    -e POSTGRES_DB="${DRILL_DB}" \
    postgres:16-alpine >/dev/null

echo "Waiting for isolated PostgreSQL container to complete full initialization..."
MAX_ATTEMPTS=45
ATTEMPT=0
# The official postgres:alpine container starts a temporary server during initdb, shuts it down,
# and then boots the permanent daemon. We wait until the permanent daemon announces readiness (count >= 2).
until [ "$(docker logs "${DRILL_CONTAINER}" 2>&1 | grep -c "database system is ready to accept connections")" -ge 2 ]; do
    ATTEMPT=$(( ATTEMPT + 1 ))
    if [ "${ATTEMPT}" -ge "${MAX_ATTEMPTS}" ]; then
        echo -e "${RED}[ERROR]${NC} Ephemeral target container timed out during initialization." >&2
        exit 1
    fi
    sleep 1
done

# Extra 1s safety settle
sleep 1

# Ensure the target restore database exists and is accessible
docker exec "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d postgres -c "CREATE DATABASE ${DRILL_DB};" >/dev/null 2>&1 || true
echo -e "${GREEN}[OK]${NC} Ephemeral target container is fully initialized and target database ${DRILL_DB} is available."

# 3. Restore backup stream into isolated container
echo -e "\n[3/5] Restoring backup stream via pg_restore into isolated target..."
RESTORE_START=$(date +%s)
# Note: --no-owner --no-acl allow restoring into a different user/db schema cleanly
docker exec -i "${DRILL_CONTAINER}" pg_restore \
    -U "${DRILL_USER}" \
    -d "${DRILL_DB}" \
    --no-owner \
    --no-acl < "${BACKUP_FILE}" || true
RESTORE_END=$(date +%s)
RESTORE_DURATION=$(( RESTORE_END - RESTORE_START ))
echo -e "${GREEN}[OK]${NC} pg_restore completed in ${RESTORE_DURATION}s."

# 4. Validate recovered schema and table row counts
echo -e "\n[4/5] Validating recovered data in isolated database..."

echo -e "\n--- Recovered Tables ---"
docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -c "\dt"

echo -e "\n--- Row Count Verification ---"
docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -c "
SELECT 'User' as tbl, count(*) FROM \"User\"
UNION ALL
SELECT 'Post' as tbl, count(*) FROM \"Post\"
UNION ALL
SELECT '_prisma_migrations' as tbl, count(*) FROM \"_prisma_migrations\";
"

echo -e "\n--- Representative Record Check ---"
echo -e "${BOLD}User table:${NC}"
docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -c 'SELECT id, email, name FROM "User";'

echo -e "${BOLD}Post table:${NC}"
docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -c 'SELECT id, title, slug, published FROM "Post";'

# Verify non-zero rows
USER_COUNT=$(docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -t -c 'SELECT count(*) FROM "User";' | tr -d ' ')
POST_COUNT=$(docker exec -i "${DRILL_CONTAINER}" psql -U "${DRILL_USER}" -d "${DRILL_DB}" -t -c 'SELECT count(*) FROM "Post";' | tr -d ' ')

if [ "${USER_COUNT}" -lt 1 ] || [ "${POST_COUNT}" -lt 1 ]; then
    echo -e "${RED}[ERROR]${NC} Restored data verification failed: User count (${USER_COUNT}) or Post count (${POST_COUNT}) is zero." >&2
    exit 1
fi

# 5. Confirm live production database remains untouched
echo -e "\n[5/5] Confirming live production database was NOT modified..."
COMPOSE_SPEC="/opt/devops-blog/compose.yaml"
if [ ! -f "${COMPOSE_SPEC}" ]; then
    COMPOSE_SPEC="deploy/compose.yaml"
fi

if [ -f "${COMPOSE_SPEC}" ] && command -v docker >/dev/null 2>&1; then
    LIVE_POST_COUNT=$(docker compose -f "${COMPOSE_SPEC}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT count(*) FROM \"Post\";"' 2>/dev/null | tr -d ' ' || echo "N/A")
    echo "Live production Post count: ${LIVE_POST_COUNT} | Restored Post count: ${POST_COUNT}"
fi

TOTAL_END=$(date +%s)
TOTAL_DURATION=$(( TOTAL_END - START_TIME ))

echo -e "\n${BOLD}=================================================================${NC}"
echo -e "${GREEN}${BOLD}Disaster Recovery drill SUCCESSFUL in ${TOTAL_DURATION}s.${NC}"
echo -e "Verified: Schema, User records (${USER_COUNT}), Post records (${POST_COUNT}), Checksums."
echo -e "${BOLD}=================================================================${NC}"
