# Incident Report: INC-01 — API Container Interruption

- **Incident ID**: INC-01
- **Title**: Express REST API Container Stopped
- **Environment**: Production (`devops-blog-prod` on OCI Ubuntu VM)
- **Date / Time**: 2026-11-02 19:50:52 UTC
- **Severity**: P2 (Major Degradation)

---

## 1. Objective
Verify monitoring, reverse proxy error response, and log behavior when the Node.js API container terminates unexpectedly.

## 2. Preconditions & Safety Checks
- Baseline verified: `https://luffydev.duckdns.org/api/health` returning HTTP 200.
- Database and frontend containers running and healthy.
- Safety check: Only the `api` container is stopped; no persistent volumes are touched.

## 3. Exact Action
```bash
docker compose -f /opt/devops-blog/compose.yaml stop api
```

## 4. Expected Behavior
- Nginx reverse proxy cannot connect to upstream `api:5000` and returns HTTP 502/504 for `/api/*`.
- Static frontend (`/`) continues to serve HTTP 200.
- Uptime Kuma detects `/api/health` DOWN within ~60–80 seconds and dispatches an alert.

## 5. Observed Behavior
- Ingress request to `/api/health` returned `HTTP/2 504 Gateway Timeout`.
- Ingress request to homepage `/` returned `HTTP/2 200 OK` (served by Nginx static container).
- Nginx proxy error log logged connection failure to upstream `api:5000`.

## 6. Relevant Redacted Logs
```text
proxy-1  | 152.59.147.230 - - [02/Nov/2026:19:50:52 +0000] "HEAD /api/health HTTP/2.0" 504 160 "-" "curl/8.7.1" "-"
proxy-1  | 152.59.147.230 - - [02/Nov/2026:19:50:52 +0000] "HEAD / HTTP/2.0" 200 0 "-" "curl/8.7.1" "-"
```

## 7. Root Cause
Deliberate administrative service stoppage via `docker compose stop api`.

## 8. Recovery Action
```bash
docker compose -f /opt/devops-blog/compose.yaml start api
```

## 9. Metrics
- **Detection Time**: Immediate upon HTTP request (< 1s); monitor cycle detected within 60s.
- **Recovery Time**: 4 seconds after `docker compose start api`.
- **Post-Recovery Verification**: `/api/health` returned `{"status":"ok","database":"up","uptime":5}` (HTTP 200).

## 10. Prevention & Follow-up
- Ensure Compose `restart: unless-stopped` policy remains configured so crashes auto-recover.
- Keep Uptime Kuma notification alerts enabled.

## 11. Final Status
RESOLVED (Closed).
