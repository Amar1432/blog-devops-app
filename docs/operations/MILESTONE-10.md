# Milestone 10 — Production Observability, Backup & Disaster Recovery

**Project:** `devops-blog`  
**Milestone:** 10  
**Domain:** `https://luffydev.duckdns.org`  
**Primary Host:** Oracle Cloud Infrastructure (OCI) Ubuntu VM (`129.154.253.114`)  
**Deployment Method:** Docker Compose (`devops-blog-prod`)  

---

## 1. Executive Summary

Milestone 10 transitions the `devops-blog` single-host production deployment into an observable, robust, and recoverable production platform. The primary objectives are:
- Continuous availability monitoring and proactive alerting via Uptime Kuma without exposing management interfaces to the public internet.
- Predictable, bounded container and reverse-proxy logging with log rotation to prevent disk exhaustion.
- Host and container resource inspection runbooks to diagnose CPU, memory, and disk saturation.
- Automated, timestamped PostgreSQL backups using native custom format (`pg_dump -Fc`) with automated retention and integrity verification.
- Proven disaster recovery via isolated database restoration without endangering production data.
- Controlled application rollback procedures leveraging immutable image references.
- Documented incident simulations and post-mortem failure reports.

---

## 2. Production Architecture

### Before Milestone 10 (Milestone 9 Baseline)
```text
Public Internet -> OCI VCN (80, 443) -> Nginx Reverse Proxy (proxy)
                                          |-- /       -> React SPA (web:80)
                                          \-- /api/*  -> Express REST API (api:5000)
                                                             |
                                                         PostgreSQL 16 (db:5432)
```

### After Milestone 10 Target Architecture
```text
                                Internet
                                   |
                         OCI VCN (80, 443, 22)
                                   |
             +---------------------+---------------------+
             |                     |                     |
        Port 80 (HTTP)      Port 443 (HTTPS)       Port 22 (SSH)
        (ACME / Redirect)   (TLS Termination)            |
                                   |              SSH Local Forwarding
                           Nginx Reverse Proxy     (-L 3001:127.0.0.1:3001)
                             /           \               |
                       React Web       Express API       v
                      (SPA on 80)     (REST on 5000)   Host Loopback
                                             |         (127.0.0.1:3001)
                                        PostgreSQL       |
                                         (db:5432)       v
                                                    Uptime Kuma
                                                   (Internal Svc)
                                                         |
                                            uptime-kuma-data (Volume)

Host Administration & Operational Tooling:
  +-- Log Rotation: Bounded json-file logging across all containers (max-size, max-file)
  +-- Observability: Host & container resource baselining (uptime, free, df, docker stats)
  +-- Backup Automation: Timestamped pg_dump (-Fc) with sha256 checksums & pg_restore verification
  +-- Disaster Recovery: Isolated container restore targets & verifiable rollback procedures
```

---

## 3. Production Service Inventory

| Service Name | Container Name | Image Reference | Published Ports | Network | Purpose |
|---|---|---|---|---|---|
| `proxy` | `devops-blog-prod-proxy-1` | `nginx:1.27-alpine` | `80:80`, `443:443` | `devops-blog-prod-network` | Edge reverse proxy, TLS termination, path routing |
| `web` | `devops-blog-prod-web-1` | `ghcr.io/amar1432/devops-blog-web:latest` | None (Internal 80) | `devops-blog-prod-network` | Static React frontend |
| `api` | `devops-blog-prod-api-1` | `ghcr.io/amar1432/devops-blog-api:latest` | None (Internal 5000) | `devops-blog-prod-network` | Express REST API & Prisma runtime |
| `db` | `devops-blog-prod-db-1` | `postgres:16-alpine` | None (Internal 5432) | `devops-blog-prod-network` | Production PostgreSQL database |
| `certbot` | `devops-blog-prod-certbot-1` | `certbot/certbot:latest` | None | `devops-blog-prod-network` | ACME TLS certificate issuance & renewal |
| `uptime-kuma` | `devops-blog-prod-uptime-kuma-1` | `louislam/uptime-kuma:1.23.16` | `127.0.0.1:3001:3001` | `devops-blog-prod-network` | Availability monitoring & alerting |

---

## 4. Milestone Phase Status

| Phase | Description | Status | Reference Doc |
|---|---|---|---|
| **10.1** | Availability Monitoring with Uptime Kuma | Implemented & Deployed | [`docs/operations/MONITORING.md`](./MONITORING.md) |
| **10.2** | Container and Application Logging | Implemented & Verified | [`docs/operations/LOGGING.md`](./LOGGING.md) |
| **10.3** | Host and Container Resource Monitoring | Implemented & Verified | [`docs/operations/RESOURCE-MONITORING.md`](./RESOURCE-MONITORING.md) |
| **10.4** | Automated PostgreSQL Backups | Implemented & Verified | [`docs/operations/BACKUP-AND-RESTORE.md`](./BACKUP-AND-RESTORE.md) |
| **10.5** | Isolated Restore and Disaster Recovery | Pending | `docs/operations/BACKUP-AND-RESTORE.md` |
| **10.6** | Application Rollback & Configuration Recovery | Pending | `docs/operations/ROLLBACK.md` |
| **10.7** | Incident Simulations & Milestone Closure | Pending | `docs/operations/INCIDENT-REPORTS/` |

---

## 5. Phase 10.1 — Implementation & Verification Evidence

### Repository Changes
- Updated `deploy/compose.yaml` to include the `uptime-kuma` service with pinned image `louislam/uptime-kuma:1.23.16`, loopback binding `127.0.0.1:3001:3001`, and named volume `uptime-kuma-data`.
- Updated `deploy/.env.example` with `UPTIME_KUMA_HOST_PORT=3001`.
- Updated `.gitignore` to prevent database dumps and test backup artifacts from entering version control.
- Created `docs/operations/MONITORING.md`.

### Production Deployment Commands (For Operator Execution)
```bash
# 1. Update repository on the server
cd /opt/devops-blog
git pull origin main

# 2. Validate Compose configuration syntax
docker compose -f deploy/compose.yaml config --quiet

# 3. Pull and start Uptime Kuma
docker compose -f deploy/compose.yaml pull uptime-kuma
docker compose -f deploy/compose.yaml up -d uptime-kuma

# 4. Verify loopback-only binding
ss -tulpn | grep 3001
```

### Evidence Captured from Server Verification

#### 1. Container Status (`docker compose ps`)
```text
NAME                             IMAGE                                     STATUS                             PORTS
devops-blog-prod-api-1           ghcr.io/amar1432/devops-blog-api:latest   Up About an hour (healthy)         5000/tcp
devops-blog-prod-db-1            postgres:16-alpine                        Up About an hour (healthy)         5432/tcp
devops-blog-prod-proxy-1         nginx:1.27-alpine                         Up About an hour                   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
devops-blog-prod-uptime-kuma-1   louislam/uptime-kuma:1.23.16              Up (health: starting)              127.0.0.1:3001->3001/tcp
devops-blog-prod-web-1           ghcr.io/amar1432/devops-blog-web:latest   Up About an hour (healthy)         80/tcp
```

#### 2. Loopback Isolation Verification (`ss -tulpn | grep 3001`)
```text
tcp   LISTEN 0      4096         127.0.0.1:3001      0.0.0.0:*
```
*Confirmation:* Port 3001 is listening strictly on the loopback IP `127.0.0.1`. It is completely inaccessible from the public internet.

#### 3. Local HTTP Response (`curl -sI http://127.0.0.1:3001`)
```text
HTTP/1.1 302 Found
X-Frame-Options: SAMEORIGIN
Location: /dashboard
Content-Length: 32
Date: Mon, 02 Nov 2026 18:59:43 GMT
Connection: keep-alive
```

---

### Remaining Evidence Placeholders (Operator UI Setup)
```text
[EVIDENCE PLACEHOLDER: Screenshot / log of Uptime Kuma dashboard showing both monitors UP]
[EVIDENCE PLACEHOLDER: DOWN notification screenshot / text for API failure test]
[EVIDENCE PLACEHOLDER: UP recovery notification screenshot / text]
```

---

## 6. Phase 10.2 — Logging & Log Rotation Verification Evidence

### 1. Enforced Container Log Options (`docker inspect`)
Verified on the live production server after container recreation:
```text
/devops-blog-prod-api-1: Driver=json-file, Options={"max-file":"3","max-size":"10m"}
/devops-blog-prod-db-1: Driver=json-file, Options={"max-file":"3","max-size":"10m"}
/devops-blog-prod-proxy-1: Driver=json-file, Options={"max-file":"5","max-size":"10m"}
/devops-blog-prod-uptime-kuma-1: Driver=json-file, Options={"max-file":"3","max-size":"10m"}
/devops-blog-prod-web-1: Driver=json-file, Options={"max-file":"3","max-size":"10m"}
```
*Confirmation:* All containers enforce strict log rotation. Total log footprint across the stack is bounded to a maximum of 180 MB, preventing filesystem exhaustion.

### 2. Standardized Log Command Inspection
```text
=== TIMESTAMPS TEST ===
api-1  | 2026-11-02T19:22:53.810674806Z Connected to the database
api-1  | 2026-11-02T19:22:53.810730921Z API listening on http://localhost:5000

=== SINCE TEST ===
proxy-1  | 127.0.0.1 - - [02/Nov/2026:19:23:32 +0000] "GET / HTTP/1.1" 301 162 "-" "Wget" "-"
```

### 3. Ingress Request Tracing
Generated test request: `curl -A "SRE-Log-Verification-10.2" https://luffydev.duckdns.org/api/health`
Captured in Nginx proxy log:
```text
proxy-1 | 152.59.147.230 - - [02/Nov/2026:19:23:57 +0000] "GET /api/health HTTP/2.0" 200 82 "-" "SRE-Log-Verification-10.2" "-"
```

---

## 7. Phase 10.3 — Host and Container Resource Baseline Evidence

Captured directly from `/opt/devops-blog/scripts/inspect-resources.sh` on the production server:

```text
=================================================================
   Production Resource Inspection — 2026-11-02 19:28:18 UTC
=================================================================

[1] Host Uptime & CPU Load
 19:28:18 up  1:37,  1 user,  load average: 0.52, 0.99, 0.85
CPU Cores detected: 2 | 1-min Load: 0.52

[2] Memory & Swap Allocation
               total        used        free      shared  buff/cache   available
Mem:           951Mi       540Mi        80Mi        10Mi       525Mi       410Mi
Swap:          2.0Gi       166Mi       1.8Gi

[3] Host Filesystem Disk Space
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        45G  6.4G   38G  15% /

[4] Docker Storage Summary
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         2.38GB    0B (0%)
Containers      6         5         5.231MB   4.588MB (87%)
Local Volumes   6         5         48.79MB   0B (0%)

[5] Container Resource Consumption (Real-time snapshot)
NAME                             CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O
devops-blog-prod-proxy-1         0.00%     4.855MiB / 951.2MiB   0.51%     27.8kB / 67.1kB   2.56MB / 397kB
devops-blog-prod-web-1           0.00%     2.746MiB / 951.2MiB   0.29%     5.28kB / 6.25kB   9.24MB / 2.4MB
devops-blog-prod-api-1           1.06%     94.8MiB / 951.2MiB    9.97%     14.5kB / 14.6kB   176MB / 28.2MB
devops-blog-prod-db-1            18.07%    15.5MiB / 951.2MiB    1.63%     12.5kB / 8.83kB   62.2MB / 12.3MB
devops-blog-prod-uptime-kuma-1   0.44%     85.91MiB / 951.2MiB   9.03%     59.3kB / 16kB     191MB / 48.8MB

[6] Operational Health Evaluation
Disk Usage: [HEALTHY] Root filesystem is at 15% capacity.
RAM Usage:  [HEALTHY] 43% memory available.
```

---

## 8. Phase 10.4 — PostgreSQL Backup Automation Evidence

### 1. Manual Backup Run Output (`scripts/backup-postgres.sh`)
```text
=================================================================
   PostgreSQL Automated Backup — 2026-11-02 19:32:59 UTC
=================================================================
Compose Spec:   /opt/devops-blog/compose.yaml
Destination:    /opt/devops-blog/backups
Target File:    devops_blog_backup_20261102_193259Z.dump
Retention Cap:  7 days

[1/3] Streaming pg_dump (-Fc custom format) from container...
[2/3] Verifying backup integrity via pg_restore --list...
[SUCCESS] Backup verified and stored: /opt/devops-blog/backups/devops_blog_backup_20261102_193259Z.dump (6.7K)

[3/3] Applying backup retention policy (7 days)...
No obsolete backup files found exceeding 7 days.

=================================================================
Backup process completed in 4s.
=================================================================
```

### 2. Directory & File Permission Verification
```text
drwx------ 2 devopsadmin devopsadmin 4096 Nov  2 19:33 .
-rw------- 1 devopsadmin devopsadmin 6824 Nov  2 19:33 devops_blog_backup_20261102_193259Z.dump
-rw------- 1 devopsadmin devopsadmin  107 Nov  2 19:33 devops_blog_backup_20261102_193259Z.dump.sha256
```
*Permissions confirmation:* Directory is restricted to `0700` (`drwx------`); backup and checksum files are restricted to `0600` (`-rw-------`).

### 3. Backup Verification Output (`scripts/verify-postgres-backup.sh`)
```text
=================================================================
   PostgreSQL Backup Verification — devops_blog_backup_20261102_193259Z.dump
=================================================================
1. Validating SHA-256 checksum... [OK]
2. Checking PostgreSQL custom format magic bytes... [OK] (PGDMP format confirmed)

3. Inspecting Table of Contents (TOC) via pg_restore...
; Archive created at 2026-11-02 19:33:01 UTC
; dbname: devops_blog_prod
; TOC Entries: 17
; Compression: gzip
; Format: CUSTOM
; Dumped by pg_dump version: 16.15

Selected TOC Entries:
217; 1259 16402 TABLE public Post devops_blog_user
216; 1259 16394 TABLE public User devops_blog_user
215; 1259 16385 TABLE public _prisma_migrations devops_blog_user
3468; 0 16402 TABLE DATA public Post devops_blog_user
3467; 0 16394 TABLE DATA public User devops_blog_user
3466; 0 16385 TABLE DATA public _prisma_migrations devops_blog_user
3319; 2606 16410 CONSTRAINT public Post Post_pkey devops_blog_user
3317; 2606 16401 CONSTRAINT public User User_pkey devops_blog_user
3314; 2606 16393 CONSTRAINT public _prisma_migrations _prisma_migrations_pkey devops_blog_user
3320; 1259 16413 INDEX public Post_published_publishedAt_idx devops_blog_user

=================================================================
Verification PASSED: backups/devops_blog_backup_20261102_193259Z.dump is a valid custom-format backup.
=================================================================
```

---

## 9. Definition of Done Checklist

- [ ] **10.1**: Uptime Kuma is deployed persistently and is not publicly exposed without authentication.
- [ ] **10.1**: Public homepage and API health are monitored.
- [ ] **10.1**: DOWN and UP transitions are verified.
- [ ] **10.1**: A notification is received successfully.
- [x] **10.2**: Container and Nginx log investigation procedures are documented.
- [x] **10.2**: Docker log rotation is configured and verified.
- [x] **10.3**: Host and container resource inspection is documented.
- [x] **10.4**: PostgreSQL backups run automatically.
- [x] **10.4**: Backup retention is implemented and tested safely.
- [x] **10.4**: Backup integrity is checked.
- [ ] **10.5**: A backup is restored into an isolated target.
- [ ] **10.5**: Restored data is validated.
- [ ] **10.6**: Application rollback is documented and tested.
- [ ] **10.7**: Required incident simulations are completed.
- [ ] **10.7**: `MILESTONE-10.md` contains reproducible evidence.
- [x] Milestone 9 public HTTPS routing and application behavior remain healthy.
