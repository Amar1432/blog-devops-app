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
| **10.1** | Availability Monitoring with Uptime Kuma | Ready for Review / Deployment | [`docs/operations/MONITORING.md`](./MONITORING.md) |
| **10.2** | Container and Application Logging | Pending | `docs/operations/LOGGING.md` |
| **10.3** | Host and Container Resource Monitoring | Pending | `docs/operations/RESOURCE-MONITORING.md` |
| **10.4** | Automated PostgreSQL Backups | Pending | `docs/operations/BACKUP-AND-RESTORE.md` |
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

## 6. Definition of Done Checklist

- [ ] **10.1**: Uptime Kuma is deployed persistently and is not publicly exposed without authentication.
- [ ] **10.1**: Public homepage and API health are monitored.
- [ ] **10.1**: DOWN and UP transitions are verified.
- [ ] **10.1**: A notification is received successfully.
- [ ] **10.2**: Container and Nginx log investigation procedures are documented.
- [ ] **10.2**: Docker log rotation is configured and verified.
- [ ] **10.3**: Host and container resource inspection is documented.
- [ ] **10.4**: PostgreSQL backups run automatically.
- [ ] **10.4**: Backup retention is implemented and tested safely.
- [ ] **10.4**: Backup integrity is checked.
- [ ] **10.5**: A backup is restored into an isolated target.
- [ ] **10.5**: Restored data is validated.
- [ ] **10.6**: Application rollback is documented and tested.
- [ ] **10.7**: Required incident simulations are completed.
- [ ] **10.7**: `MILESTONE-10.md` contains reproducible evidence.
- [x] Milestone 9 public HTTPS routing and application behavior remain healthy.
