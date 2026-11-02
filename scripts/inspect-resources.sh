#!/usr/bin/env bash
# ==============================================================================
# inspect-resources.sh — DevOps Blog Host & Container Resource Inspection
# Strictly read-only. Safe to execute repeatedly on the production VM.
# ==============================================================================

set -euo pipefail

# Visual formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}=================================================================${NC}"
echo -e "${BOLD}   Production Resource Inspection — $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${BOLD}=================================================================${NC}"

# 1. Host Identity & Uptime
echo -e "\n${BOLD}[1] Host Uptime & CPU Load${NC}"
uptime
NUM_CPUS=$(nproc 2>/dev/null || echo 1)
LOAD_1MIN=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ')
echo "CPU Cores detected: ${NUM_CPUS} | 1-min Load: ${LOAD_1MIN}"

# 2. Memory & Swap
echo -e "\n${BOLD}[2] Memory & Swap Allocation${NC}"
free -h

# 3. Host Storage
echo -e "\n${BOLD}[3] Host Filesystem Disk Space${NC}"
df -h -x tmpfs -x devtmpfs -x squashfs

# 4. Docker Storage Breakdown
echo -e "\n${BOLD}[4] Docker Storage Summary${NC}"
if command -v docker >/dev/null 2>&1; then
    docker system df
else
    echo "Docker CLI not found."
fi

# 5. Container Real-time Resource Usage
echo -e "\n${BOLD}[5] Container Resource Consumption (Real-time snapshot)${NC}"
if command -v docker >/dev/null 2>&1; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
fi

# 6. Operational Health Assessment
echo -e "\n${BOLD}[6] Operational Health Evaluation${NC}"

# Check Disk Capacity
DISK_USAGE_PCT=$(df / --output=pcent | tail -n 1 | tr -d '% ')
if [ "${DISK_USAGE_PCT}" -ge 90 ]; then
    echo -e "Disk Usage: [${RED}CRITICAL${NC}] Root filesystem is at ${DISK_USAGE_PCT}% capacity!"
elif [ "${DISK_USAGE_PCT}" -ge 80 ]; then
    echo -e "Disk Usage: [${YELLOW}WARNING${NC}] Root filesystem is at ${DISK_USAGE_PCT}% capacity."
else
    echo -e "Disk Usage: [${GREEN}HEALTHY${NC}] Root filesystem is at ${DISK_USAGE_PCT}% capacity."
fi

# Check Available Memory
if command -v awk >/dev/null 2>&1; then
    MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_AVAIL_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    MEM_AVAIL_PCT=$(( 100 * MEM_AVAIL_KB / MEM_TOTAL_KB ))

    if [ "${MEM_AVAIL_PCT}" -le 10 ]; then
        echo -e "RAM Usage:  [${RED}CRITICAL${NC}] Only ${MEM_AVAIL_PCT}% memory available!"
    elif [ "${MEM_AVAIL_PCT}" -le 20 ]; then
        echo -e "RAM Usage:  [${YELLOW}WARNING${NC}] ${MEM_AVAIL_PCT}% memory available."
    else
        echo -e "RAM Usage:  [${GREEN}HEALTHY${NC}] ${MEM_AVAIL_PCT}% memory available."
    fi
fi

echo -e "\n${BOLD}=================================================================${NC}"
echo "Inspection completed successfully. No state changes made."
