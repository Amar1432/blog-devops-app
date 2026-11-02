# Incident Report: INC-03 — Database Service Interruption

- **Incident ID**: INC-03
- **Title**: PostgreSQL Database Container Stopped
- **Environment**: Production (`devops-blog-prod` on OCI Ubuntu VM)
- **Date / Time**: 2026-11-02 19:52:01 UTC
- **Severity**: P1 (Critical Outage)

---

## 1. Objective
Verify health check failure response, API status codes, and recovery dynamics when the PostgreSQL database becomes unreachable.

## 2. Preconditions & Safety Checks
- Baseline verified: Database healthy with 3 posts and 1 user.
- Volume protection: Persistent volume `devops-blog-prod-postgres-data` must remain mounted and untouched.

## 3. Exact Action
```bash
docker compose -f /opt/devops-blog/compose.yaml stop db
```

## 4. Expected Behavior
- API `/api/health` queries `SELECT 1` via Prisma. Catch block triggers and returns HTTP 503 Service Unavailable with `database: down`.
- Static frontend `/` continues to return HTTP 200.

## 5. Observed Behavior
- `curl https://luffydev.duckdns.org/api/health` returned:
  ```json
  {"status":"error","database":"down","uptime":60,"timestamp":"2026-11-02T19:52:01.106Z"}
  ```
  HTTP Status: `503 Service Unavailable`.
- Homepage `/` remained `HTTP 200`.

## 6. Root Cause
Deliberate database container shutdown via `docker compose stop db`.

## 7. Recovery Action
```bash
docker compose -f /opt/devops-blog/compose.yaml start db
```

## 8. Metrics
- **Detection Time**: Immediate (< 1s) upon request; Uptime Kuma alerts DOWN on next heartbeat.
- **Recovery Time**: 5 seconds.
- **Post-Recovery Health**:
  ```json
  {"status":"ok","database":"up","uptime":69,"timestamp":"2026-11-02T19:52:09.802Z"}
  ```
  HTTP Status: `200 OK`.

## 9. Final Status
RESOLVED (Closed).
