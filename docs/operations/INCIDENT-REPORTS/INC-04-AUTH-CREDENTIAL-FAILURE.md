# Incident Report: INC-04 — Database Credential Rejection in Isolated Container

- **Incident ID**: INC-04
- **Title**: Invalid PostgreSQL Credentials Authentication Failure
- **Environment**: Isolated Ephemeral Test on OCI Ubuntu VM
- **Date / Time**: 2026-11-02 19:52:39 UTC
- **Severity**: P3 (Simulated Misconfiguration)

---

## 1. Objective
Test database authentication failure handling and log generation without modifying the production `.env` file or risking application stability.

## 2. Preconditions & Safety Checks
- Safety check: Production credentials in `/opt/devops-blog/.env` must remain strictly untouched.
- Ephemeral test container run with `--rm` to auto-clean on completion.

## 3. Exact Action
```bash
docker run --rm --network devops-blog-prod-network \
  -e PGPASSWORD=invalid_password_simulation \
  postgres:16-alpine \
  psql -h db -U devops_blog_user -d devops_blog_prod -c 'SELECT 1'
```

## 4. Expected Behavior
PostgreSQL rejects the connection with a `FATAL: password authentication failed` error. Live production application remains unaffected.

## 5. Observed Behavior
Connection was immediately rejected by PostgreSQL:
```text
psql: error: connection to server at "db" (172.18.0.2), port 5432 failed: FATAL:  password authentication failed for user "devops_blog_user"
```

## 6. Live Production Health Confirmation
Immediately verified `/api/health`:
```json
{"status":"ok","database":"up","uptime":98,"timestamp":"2026-11-02T19:52:39.616Z"}
```
Production remained completely healthy and unaffected throughout the simulation.

## 7. Final Status
RESOLVED (Closed).
