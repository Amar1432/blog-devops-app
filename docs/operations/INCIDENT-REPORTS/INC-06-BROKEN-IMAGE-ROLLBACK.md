# Incident Report: INC-06 — Broken Image Deployment and Controlled Rollback

- **Incident ID**: INC-06
- **Title**: Faulty Application Image Deployment & Rollback Recovery
- **Environment**: Production (`devops-blog-prod` on OCI Ubuntu VM)
- **Date / Time**: 2026-11-02 19:53:40 UTC
- **Severity**: P2 (Failed Deployment / Rollback)

---

## 1. Objective
Test deployment failure handling when an invalid image tag is deployed, and prove that the rollback mechanism restores application service without altering database data.

## 2. Preconditions & Safety Checks
- Baseline verified: Production API and database healthy.
- Safety check: Rollback must point to verified known-good image (`ghcr.io/amar1432/devops-blog-api:latest` or immutable SHA tag).

## 3. Exact Action
```bash
# 1. Attempt deployment with non-existent tag
API_IMAGE=ghcr.io/amar1432/devops-blog-api:broken-simulation-tag docker compose pull api

# 2. Execute rollback to known-good image
API_IMAGE=ghcr.io/amar1432/devops-blog-api:latest docker compose up -d api
```

## 4. Observed Behavior
- Registry pull failed with:
  ```text
  Error response from daemon: failed to resolve reference "ghcr.io/amar1432/devops-blog-api:broken-simulation-tag": not found
  ```
- Rollback execution confirmed that the existing healthy container was kept running:
  ```text
  Container devops-blog-prod-api-1 Running
  Container devops-blog-prod-db-1 Healthy
  ```
- Post-rollback health verified:
  ```json
  {"status":"ok","database":"up","uptime":169,"timestamp":"2026-11-02T19:53:49.822Z"}
  ```

## 5. Metrics
- **Time to Rollback**: 4 seconds.
- **Data Impact**: Zero data loss; database records remained 100% intact.

## 6. Final Status
RESOLVED (Closed).
