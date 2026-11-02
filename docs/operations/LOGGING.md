# Container and Application Logging Runbook

This operational runbook documents log architectures, bounded log rotation configuration, inspection procedures, request correlation, and troubleshooting strategies for the `devops-blog` production platform.

---

## 1. Logging Architecture & Inventory

In this production deployment, all services emit operational events and access entries to standard output (`stdout`) and standard error (`stderr`). The Docker daemon captures these streams via the `json-file` logging driver.

```text
 Client Request (https://luffydev.duckdns.org/api/...)
                      |
                      v
             [proxy (Nginx 1.27)]
             stdout: Nginx access.log ($remote_addr, $request, $status, $bytes)
             stderr: Nginx error.log (worker notices, SSL errors, upstream connection fails)
                      |
                      v (Internal Proxy Pass)
             [api (Node.js 22 / Express)]
             stdout: Startup messages, database connection readiness
             stderr: console.error(err) with stack traces for unhandled exceptions
                      |
                      v
             [db (PostgreSQL 16)]
             stdout/stderr: Connection handshakes, checkpoints, query errors, server readiness
                      |
                      v
             [uptime-kuma (Node.js)]
             stdout: Socket events, monitor heartbeats, notification dispatches
```

### Service-by-Service Inventory

| Service | Emitted Data | Default Destination | Primary Use Case |
|---|---|---|---|
| `proxy` | Ingress access log, TLS handshake notices, upstream proxy errors | `stdout` / `stderr` | Request tracing, client IP auditing, 4xx/5xx detection, TLS diagnostics |
| `api` | Startup events, unhandled exception stack traces (`console.error`) | `stdout` / `stderr` | Application bug diagnosis, database connection issues |
| `web` | Nginx internal access logs for static assets | `stdout` / `stderr` | SPA asset serving status |
| `db` | Server lifecycle, recovery, checkpointing, constraint violations | `stdout` / `stderr` | PostgreSQL diagnostics, connection pooling saturation |
| `uptime-kuma`| Monitor heartbeat dispatches, notification delivery statuses | `stdout` / `stderr` | Verifying alert delivery and monitoring cycles |
| `certbot` | ACME challenge logs, renewal certificates status | `stdout` / `stderr` | Verifying Let's Encrypt automated renewals |

---

## 2. Bounded Log Rotation Configuration

### The Unbounded Log Growth Risk
By default, Docker's `json-file` logging driver retains container logs indefinitely with no size limit. Over time or during traffic spikes/error loops, log files grow until the host filesystem reaches 100% capacity, freezing PostgreSQL and causing total application downtime.

### Enforced Limits in `deploy/compose.yaml`
We enforce strict bounded log rotation across all containers:

```yaml
# Reusable logging anchor
x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

services:
  db:
    logging: *default-logging        # Capped at 30 MB (3 files x 10 MB)
  api:
    logging: *default-logging       # Capped at 30 MB (3 files x 10 MB)
  web:
    logging: *default-logging       # Capped at 30 MB (3 files x 10 MB)
  proxy:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"               # Capped at 50 MB (5 files x 10 MB for higher traffic)
  uptime-kuma:
    logging: *default-logging       # Capped at 30 MB (3 files x 10 MB)
  certbot:
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"               # Capped at 10 MB (2 files x 5 MB)
```

**Total Maximum Log Footprint:**  
`30MB (db) + 30MB (api) + 30MB (web) + 50MB (proxy) + 30MB (kuma) + 10MB (certbot) = 180 MB max host disk usage`.

> [!NOTE]
> **Container Recreation Requirement**: Changing `logging` options in Compose requires container recreation (`docker compose up -d`). A simple `docker compose restart` does not update the container's underlying `HostConfig.LogConfig` metadata.

---

## 3. Log Inspection Commands

All log commands must be executed from `/opt/devops-blog` on the production server.

### 1. View Most Recent Logs
```bash
# View last 100 lines for a specific service
docker compose -f deploy/compose.yaml logs --tail=100 api
docker compose -f deploy/compose.yaml logs --tail=100 proxy
```

### 2. Stream / Follow Live Logs
```bash
# Follow logs in real-time (useful during deployments or failure tests)
docker compose -f deploy/compose.yaml logs --follow api
```

### 3. Display Precise ISO Timestamps
```bash
# Show timestamps prepended to each log entry
docker compose -f deploy/compose.yaml logs --timestamps --tail=50 proxy
```

### 4. Filter by Time Window
```bash
# View logs generated within the last 30 minutes
docker compose -f deploy/compose.yaml logs --since=30m api

# View logs generated within the last 2 hours
docker compose -f deploy/compose.yaml logs --since=2h proxy
```

### 5. Multi-Service Correlated Following
```bash
# Stream Nginx proxy and Express API logs simultaneously
docker compose -f deploy/compose.yaml logs --follow proxy api
```

---

## 4. Request Correlation Workflow

When troubleshooting a user-reported failure or alert:

1. **Find the incident in Nginx Proxy logs**:
   ```bash
   docker compose -f deploy/compose.yaml logs --since=15m proxy | grep -E '" (4|5)[0-9]{2} '
   ```
   *Sample entry:*
   ```text
   proxy-1 | 152.59.147.230 - - [02/Nov/2026:19:23:57 +0000] "GET /api/health HTTP/2.0" 200 82 "-" "SRE-Log-Verification-10.2" "-"
   ```
   Note the exact timestamp (`19:23:57 +0000`), client IP, method, and URI path (`/api/health`).

2. **Cross-reference API logs at the same timestamp**:
   ```bash
   docker compose -f deploy/compose.yaml logs --timestamps --since=15m api
   ```
   Match the ISO timestamp (`2026-11-02T19:23:57Z`) to see if an application error, database timeout, or unhandled exception was logged at that moment.

---

## 5. Troubleshooting Common HTTP Status Codes

### 1. HTTP 404 (Not Found)
- **Symptom**: User sees a JSON 404 response or browser blank page.
- **Diagnostic Steps**:
  1. Check Nginx proxy log: If URI is `/api/*`, the request reached the API container.
  2. Inspect Express router: Check `apps/api/src/routes/` to verify if the route is defined.
  3. If URI is NOT `/api/*`, Nginx routes the request to `web:80` (the React SPA). The SPA's internal router handles client-side paths.
- **Resolution**:
  - For API: Verify spelling and method in the frontend fetch call.
  - For Web: Verify Nginx SPA fallback `try_files $uri $uri/ /index.html` is properly configured in `apps/web/nginx.conf`.

### 2. HTTP 502 (Bad Gateway)
- **Symptom**: Nginx cannot communicate with upstream container (`api` or `web`).
- **Nginx error log signature**:
  ```text
  [error] 1#1: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 1.2.3.4, server: luffydev.duckdns.org, request: "GET /api/posts HTTP/2.0", upstream: "http://172.18.0.3:5000/api/posts"
  ```
- **Causes**:
  1. The API container crashed or exited.
  2. The API process is starting up and hasn't yet opened port 5000.
  3. Docker network connectivity issue between proxy and api.
- **Resolution**:
  1. Run `docker compose ps api` to check if API is `Up (healthy)`.
  2. Inspect crash reason: `docker compose logs --tail=100 api`.
  3. Verify database connectivity: API exits or marks unhealthy if PostgreSQL is down.

### 3. HTTP 504 (Gateway Timeout)
- **Symptom**: Nginx waits for upstream response until `proxy_read_timeout` (configured at 30s) expires.
- **Nginx error log signature**:
  ```text
  [error] 1#1: *1 upstream timed out (110: Connection timed out) while reading response header from upstream
  ```
- **Causes**:
  1. Long-running or locked database query in PostgreSQL.
  2. Heavy computational loop blocking Node.js single-threaded event loop.
  3. Network freeze between API and external service.
- **Resolution**:
  1. Inspect PostgreSQL active queries:
     `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle';"`
  2. Inspect API CPU utilization: `docker stats --no-stream api`.

---

## 6. Security & Sensitive Data Guidelines

1. **No Credentials in Logs**:
   - Never log passwords, password hashes, JWTs, Bearer tokens, Cookie values, or database connection strings.
   - Headers: Nginx log format explicitly omits `Authorization` and `Cookie` headers from access logs.
2. **No Full Request Bodies by Default**:
   - Express `express.json()` parses payloads, but request bodies must never be blindly dumped to stdout in production.
3. **No Permanent Debug Mode**:
   - Production runs with `NODE_ENV=production`. Verbose query tracing (`PrismaClient({ log: ['query'] })`) must remain disabled in production to protect customer privacy and performance.
