# Host and Container Resource Monitoring Runbook

This runbook establishes a practical, low-overhead resource-inspection practice for the Oracle Cloud Infrastructure (OCI) Ubuntu VM and Docker containers running the `devops-blog` production platform.

---

## 1. Host vs Container Resource Model

Understanding the distinction between host-level and container-level resource metrics prevents misdiagnoses:

```text
+-----------------------------------------------------------------------+
| OCI Ubuntu Host (2 vCPUs, 951 MiB RAM, 2.0 GiB Swap, 45 GB NVMe)      |
|                                                                       |
|  Kernel, Systemd, SSH Daemon, Docker Daemon (dockerd), OS Page Cache  |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | devops-blog-prod Docker Bridge Network                          |  |
|  |                                                                 |  |
|  |  +----------------+  +----------------+  +-------------------+  |  |
|  |  | proxy (~5MB)   |  | web (~3MB)     |  | api (~95MB)       |  |  |
|  |  +----------------+  +----------------+  +-------------------+  |  |
|  |  +----------------+  +---------------------------------------+  |  |
|  |  | db (~16MB)     |  | uptime-kuma (~86MB)                   |  |  |
|  |  +----------------+  +---------------------------------------+  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

### Key Conceptual Distinctions:
1. **Memory (`free -h` vs `docker stats`)**:
   - `free -h` reflects the entire host. Linux aggressively uses unused RAM for file caching (`buff/cache`). A low "free" memory number is normal; the critical metric to monitor is **`available`** memory and swap consumption.
   - `docker stats` reflects resident set size (RSS) memory consumed by processes inside individual cgroups. The sum of all container memory is ~205 MiB, leaving ample memory for kernel operations and OS caching.
2. **CPU Load Average (`uptime` vs `docker stats`)**:
   - `uptime` load average represents the number of threads either actively computing or waiting for uninterruptible disk I/O across the entire system. On a 2 vCPU machine, a load average below `2.00` indicates that CPU capacity is not saturated.
   - `docker stats` shows instantaneous CPU % per container. Spikes during database queries or Node.js startup are expected, provided load averages remain within bounds.

---

## 2. Host Resource Inspection Commands

Run these commands from an SSH session (`ssh devops-admin`):

### 1. Host Uptime & CPU Load
```bash
uptime
```
- **Healthy**: Load average under 2.0 (for 2 vCPUs).
- **Unhealthy**: Load average steadily > 3.0, indicating queuing or blocked disk I/O.

### 2. Physical Memory and Swap
```bash
free -h
```
- **Healthy**: Available memory > 200 MiB; Swap used < 500 MiB.
- **Unhealthy**: Available memory < 80 MiB with continuous swap thrashing (high `si`/`so` in `vmstat 1`).

### 3. Disk Space Capacity
```bash
df -h /
```
- **Healthy**: Root filesystem `/` utilization < 75%.
- **Warning**: Utilization reaches 80%.
- **Critical**: Utilization exceeds 90% (risk of database WAL freeze and container write failures).

### 4. Kernel Out-of-Memory (OOM) & Hardware Events
```bash
sudo dmesg -T | grep -i -E "oom|out of memory|killed process"
```
- Check if the Linux kernel OOM killer has terminated any processes.

### 5. Systemd Journal Logs
```bash
sudo journalctl -u docker.service --since "1 hour ago" --no-pager
```

---

## 3. Docker Storage & Container Metrics

### 1. Dynamic Container Resource Snapshot
```bash
docker stats --no-stream
```
*Outputs real-time CPU %, RAM usage, Memory %, Network I/O, Block I/O, and PID count per container.*

### 2. Inspect Docker Disk Footprint
```bash
docker system df
```
*Categorizes storage consumption into Images, Containers, Local Volumes, and Build Cache.*

### 3. Identify Root Storage Location
```bash
docker info --format 'DockerRootDir: {{.DockerRootDir}}'
```
*Confirms `/var/lib/docker` as the host data root.*

### 4. Inspect Directory Size Breakdown without Deletion
```bash
sudo du -h -d 1 /var/lib/docker 2>/dev/null | sort -hr
```
*Identifies which Docker subsystem (overlay2 rootfs, volumes, or containers) consumes disk space.*

---

## 4. Production Resource Baseline (Captured 2026-11-02)

| Resource Metric | Baseline Value | Operational Assessment |
|---|---|---|
| **Host CPU Cores** | 2 vCPUs (AMD EPYC) | Load average: `0.52, 0.99, 0.85` (Well below 2.0 ceiling) |
| **Physical RAM** | 951 MiB Total | 540 MiB used, 410 MiB available (43% available) — **Healthy** |
| **Swap Storage** | 2.0 GiB Total | 166 MiB used, 1.8 GiB free — **Healthy** |
| **Root Disk (`/`)** | 45 GB NVMe SSD | 6.4 GB used, 38 GB available (15% Use%) — **Healthy** |
| **Docker Storage** | 1.6 GB Total | Images: 2.38GB virtual, Volumes: 48MB, Containers: 5MB |
| `proxy` RAM | ~4.8 MiB (0.5%) | Negligible footprint |
| `web` RAM | ~2.7 MiB (0.3%) | Negligible footprint |
| `api` RAM | ~95 MiB (10.0%) | Steady Node.js / Express runtime memory |
| `db` RAM | ~16 MiB (1.6%) | Lightweight PostgreSQL idle footprint |
| `uptime-kuma` RAM | ~86 MiB (9.0%) | Node.js monitoring daemon with SQLite buffer |

---

## 5. Operational Warning Thresholds

These thresholds provide concrete operational guidelines for monitoring alerts:

| Metric | Warning Threshold | Critical Threshold | Recommended Action |
|---|---|---|---|
| **Root Disk (`/`)** | **>= 80%** | **>= 90%** | Inspect container logs, clean dangling images, prune rotated backups. |
| **Available RAM** | **<= 20%** (~190 MB) | **<= 10%** (~95 MB) | Identify leaking container via `docker stats`, restart runaway process. |
| **Swap Consumption**| **>= 500 MB** | **>= 1.2 GB** | Host is memory-constrained; examine container memory limits. |
| **1-min CPU Load** | **>= 2.50** | **>= 4.00** | Check PostgreSQL lock contention, API compute loops, or DDoS traffic. |

---

## 6. Safe Disk Investigation and Cleanup Rules

> [!CAUTION]
> **Production Safety Invariants**:
> 1. **NEVER** run `docker system prune -a` or `docker volume prune` in production. These commands delete unattached persistent volumes and flush required local caches.
> 2. **NEVER** remove named volumes `devops-blog-prod-postgres-data` or `devops-blog-prod-certbot-etc`.

### Safe Investigation Workflow:
1. **Locate the growth source**:
   ```bash
   sudo du -h -d 2 /var/lib/docker/volumes 2>/dev/null
   sudo du -h -d 1 /var/log 2>/dev/null
   ```
2. **Safe removal of dangling images only**:
   ```bash
   # Removes ONLY untagged (<none>) image layers that are not referenced by any container
   docker image prune -f
   ```
3. **Safe cleanup of rotated system logs**:
   ```bash
   # Vacuums systemd journal files older than 7 days
   sudo journalctl --vacuum-time=7d
   ```

---

## 7. Automated Inspection Script (`scripts/inspect-resources.sh`)

A dedicated, idempotent, and completely read-only inspection script is provided at [`scripts/inspect-resources.sh`](../../scripts/inspect-resources.sh).

### Running on Server:
```bash
/opt/devops-blog/scripts/inspect-resources.sh
```
It immediately outputs:
- Host identity, core count, and CPU load
- Memory and swap breakdown
- Filesystem capacity
- Docker storage distribution
- Container-by-container resource utilization table
- Automated `[HEALTHY]`, `[WARNING]`, or `[CRITICAL]` status evaluations for disk and memory.
