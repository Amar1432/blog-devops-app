# Incident Report: INC-02 — Web Container Interruption

- **Incident ID**: INC-02
- **Title**: Web SPA Frontend Container Stopped
- **Environment**: Production (`devops-blog-prod` on OCI Ubuntu VM)
- **Date / Time**: 2026-11-02 19:51:32 UTC
- **Severity**: P2 (Major Degradation)

---

## 1. Objective
Verify reverse proxy behavior and service isolation when the React frontend container is stopped.

## 2. Preconditions & Safety Checks
- Ingress checked: `https://luffydev.duckdns.org/` returning HTTP 200.
- Safety check: Only `web` container is targeted.

## 3. Exact Action
```bash
docker compose -f /opt/devops-blog/compose.yaml stop web
```

## 4. Expected Behavior
- Root URL `/` returns HTTP 502/504 from Nginx reverse proxy.
- Backend API endpoints (`/api/health`, `/api/posts`) remain fully operational (HTTP 200).

## 5. Observed Behavior
- `curl -sI https://luffydev.duckdns.org/` -> `HTTP/2 504 Gateway Timeout`.
- `curl -sI https://luffydev.duckdns.org/api/health` -> `HTTP/2 200 OK` (unaffected).

## 6. Relevant Redacted Logs
```text
proxy-1  | 152.59.147.230 - - [02/Nov/2026:19:51:32 +0000] "HEAD / HTTP/2.0" 504 160 "-" "curl/8.7.1" "-"
proxy-1  | 152.59.147.230 - - [02/Nov/2026:19:51:32 +0000] "HEAD /api/health HTTP/2.0" 200 82 "-" "curl/8.7.1" "-"
```

## 7. Root Cause
Deliberate service stoppage via `docker compose stop web`.

## 8. Recovery Action
```bash
docker compose -f /opt/devops-blog/compose.yaml start web
```

## 9. Metrics
- **Detection Time**: Immediate (< 1s).
- **Recovery Time**: 3 seconds.
- **Post-Recovery Verification**: Homepage `/` returned `HTTP/2 200 OK`.

## 10. Final Status
RESOLVED (Closed).
