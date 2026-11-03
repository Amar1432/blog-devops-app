#!/usr/bin/env bash
# =============================================================================
# Production Post-Deployment Smoke Test Script
# Validates public edge routing, TLS, API health, and database connectivity.
# Strict failure handling: exits with code 1 if any check fails.
# =============================================================================

set -euo pipefail

BASE_URL="${1:-https://luffydev.duckdns.org}"
HTTP_URL="${BASE_URL/https:\/\//http:\/\/}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW} Starting Post-Deployment Smoke Tests: ${BASE_URL}${NC}"
echo -e "${YELLOW}======================================================${NC}"

FAILED=0

# 1. HTTP to HTTPS 301 Redirect Check
echo -n "Checking HTTP to HTTPS redirect... "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL" || true)
if [ "$HTTP_STATUS" = "301" ]; then
    echo -e "${GREEN}PASS (301 Moved Permanently)${NC}"
else
    echo -e "${RED}FAIL (Expected 301, got $HTTP_STATUS)${NC}"
    FAILED=1
fi

# 2. Public Homepage (React SPA)
echo -n "Checking public homepage (HTTP 200)... "
HOMEPAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" || true)
if [ "$HOMEPAGE_STATUS" = "200" ]; then
    echo -e "${GREEN}PASS (200 OK)${NC}"
else
    echo -e "${RED}FAIL (Expected 200, got $HOMEPAGE_STATUS)${NC}"
    FAILED=1
fi

# 3. Public API Health Endpoint
echo -n "Checking API health endpoint (/api/health)... "
HEALTH_RESPONSE=$(curl -fsS "$BASE_URL/api/health" 2>/dev/null || true)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"' && echo "$HEALTH_RESPONSE" | grep -q '"database":"up"'; then
    echo -e "${GREEN}PASS (API OK, DB UP)${NC}"
    echo "  Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}FAIL (Unhealthy response: $HEALTH_RESPONSE)${NC}"
    FAILED=1
fi

# 4. Read-Only API Data Endpoint (/api/posts)
echo -n "Checking read-only API posts endpoint (/api/posts)... "
POSTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/posts" || true)
if [ "$POSTS_STATUS" = "200" ]; then
    echo -e "${GREEN}PASS (200 OK)${NC}"
else
    echo -e "${RED}FAIL (Expected 200, got $POSTS_STATUS)${NC}"
    FAILED=1
fi

echo -e "${YELLOW}======================================================${NC}"
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN} ALL SMOKE TESTS PASSED SUCCESSFULLY!${NC}"
    echo -e "${YELLOW}======================================================${NC}"
    exit 0
else
    echo -e "${RED} SMOKE TESTS FAILED! IMMEDIATE INVESTIGATION REQUIRED.${NC}"
    echo -e "${YELLOW}======================================================${NC}"
    exit 1
fi
