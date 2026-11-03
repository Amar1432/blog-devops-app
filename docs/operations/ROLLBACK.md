# Application Rollback and Configuration Recovery Runbook

This operational runbook documents the procedures for rolling back application containers, validating infrastructure configurations, and recovering from faulty deployments in the `devops-blog` production platform.

---

## 1. Rollback Philosophy & Principles

1. **Immutable Image References Over `:latest`**:
   The mutable `:latest` tag changes on every build. If a faulty image was pushed and overwritten `:latest`, rolling back requires deploying an immutable artifact:
   - **Short Commit-SHA tag**: `ghcr.io/amar1432/devops-blog-api:sha-<short-sha>`
   - **Unique Image Digest**: `ghcr.io/amar1432/devops-blog-api@sha256:<digest>`
2. **Database Isolation**:
   An application rollback must **never** modify the PostgreSQL database schema or data volume. Application container recreation leaves `devops-blog-prod-postgres-data` untouched.
3. **Configuration Pre-Validation**:
   Never apply an Nginx or Compose configuration change without first running `nginx -t` and `docker compose config --quiet`.

---

## 2. Inspecting Currently Deployed Images

Run on the server from `/opt/devops-blog`:

```bash
# 1. Inspect exact image digest for API container
docker image inspect $(docker inspect $(docker compose ps -q api) --format '{{.Image}}') \
  --format 'API Image: {{.RepoTags}} | Digest: {{json .RepoDigests}}'

# 2. Inspect exact image digest for Web container
docker image inspect $(docker inspect $(docker compose ps -q web) --format '{{.Image}}') \
  --format 'Web Image: {{.RepoTags}} | Digest: {{json .RepoDigests}}'
```

---

## 3. Selecting a Previous Known-Good Image

### Method 1: Git Commit History
Every push to `main` publishes images tagged with `sha-<commit>`.
Find the previous stable commit SHA on `main`:
```bash
git log --oneline -n 10
```
*Example: If commit `c4914d8` was the last stable release, the corresponding GHCR tag is:*
`ghcr.io/amar1432/devops-blog-api:sha-c4914d8`

### Method 2: Inspecting Local Docker Image Cache
Check which previously pulled image versions already exist locally on the host:
```bash
docker images --filter "reference=ghcr.io/amar1432/*"
```

---

## 4. Application Rollback Execution Procedure

### Method A: Rollback via Coolify Dashboard (Primary CD Path)

If a deployment orchestrated by Coolify introduces an issue:

1. Open Coolify dashboard ➔ Go to your `devops-blog-prod` Compose resource.
2. Go to **Environment Variables**.
3. Set the image overrides to the previous known-good commit SHA tags:
   ```env
   API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<previous-commit-sha>
   WEB_IMAGE=ghcr.io/amar1432/devops-blog-web:sha-<previous-commit-sha>
   ```
4. Click **Deploy**.
5. Coolify will pull the specified immutable tags and restart `api` and `web` containers.
6. The PostgreSQL volume (`devops-blog-prod-postgres-data`) and Nginx configuration remain untouched.

---

### Method B: Emergency Fallback via Workload Host CLI (Direct Server Path)

If Coolify or the control plane is offline:

1. SSH into the OCI host:
   ```bash
   ssh devopsadmin@129.154.253.114
   cd /opt/devops-blog
   ```
2. Edit `/opt/devops-blog/.env` to pin the previous release:
   ```bash
   API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<previous-commit-sha>
   WEB_IMAGE=ghcr.io/amar1432/devops-blog-web:sha-<previous-commit-sha>
   ```
3. Recreate the containers:
   ```bash
   docker compose pull api web
   docker compose up -d api web
   ```
4. Confirm container health:
   ```bash
   docker compose ps api web
   ```

---

## 5. Configuration Backup & Recovery (Nginx & Compose)

Configuration files must always be backed up before editing.

### 1. Nginx Reverse Proxy Configuration
Before editing `/opt/devops-blog/nginx/default.conf`:
```bash
# 1. Create timestamped backup
cp /opt/devops-blog/nginx/default.conf /opt/devops-blog/nginx/default.conf.bak-$(date +%Y%m%d_%H%M%S)

# 2. Edit configuration
# (apply changes)

# 3. MANDATORY: Validate syntax before applying
docker compose exec proxy nginx -t

# 4. If syntax passes: Reload without dropping active connections
docker compose exec proxy nginx -s reload

# 5. If syntax fails: Instantly restore backup
cp /opt/devops-blog/nginx/default.conf.bak-<timestamp> /opt/devops-blog/nginx/default.conf
docker compose exec proxy nginx -t
docker compose exec proxy nginx -s reload
```

### 2. Docker Compose Configuration
Before editing `/opt/devops-blog/compose.yaml`:
```bash
# 1. Create timestamped backup
cp /opt/devops-blog/compose.yaml /opt/devops-blog/compose.yaml.bak-$(date +%Y%m%d_%H%M%S)

# 2. Edit file
# (apply changes)

# 3. MANDATORY: Validate syntax
docker compose config --quiet

# 4. Apply changes safely
docker compose up -d
```

---

## 6. Post-Rollback Smoke-Test Checklist

After performing any rollback or configuration recovery, verify all 5 critical paths:

```bash
# 1. Public Homepage returns HTTP 200
curl -fsS -o /dev/null -w "%{http_code}\n" https://luffydev.duckdns.org/
# Expected: 200

# 2. API Health endpoint returns status: ok and database: up
curl -fsS https://luffydev.duckdns.org/api/health
# Expected: {"status":"ok","database":"up",...}

# 3. API Data endpoint returns published posts
curl -fsS https://luffydev.duckdns.org/api/posts
# Expected: JSON array containing active blog posts

# 4. Existing Content intact
curl -fsS https://luffydev.duckdns.org/api/posts | grep -q "First Production Post" && echo "Content Verified!"

# 5. Uptime Kuma monitoring status
# Verify in dashboard (http://127.0.0.1:3001) that both monitors remain UP
```

---

## 7. Diagnostic Troubleshooting & Failure Handling

### Scenario A: Webhook Accepted (HTTP 200) but Deployment Failed
- **Root Cause:** Coolify's webhook asynchronously queues the deployment. A 200 HTTP response only confirms the job was queued, not that Docker pull/reconcile succeeded.
- **Troubleshooting Steps:**
  1. Open Coolify dashboard ➔ Resource ➔ **Deployments**.
  2. Inspect the latest deployment log stream.
  3. Common issues:
     - SSH timeout between Coolify VM and OCI server.
     - Docker Compose parsing failure (check "Show Deployable Compose").
     - Disk full on OCI server (`df -h`).

### Scenario B: Deployment Succeeded but Public Site Returns 502/504 Bad Gateway
- **Root Cause:** Nginx is running, but cannot reach upstream `api:5000` or `web:80` via Docker internal DNS.
- **Troubleshooting Steps:**
  1. Check if application containers are running:
     ```bash
     docker ps --format "{{.Names}}\t{{.Status}}"
     ```
  2. Verify network membership:
     ```bash
     docker network inspect devops-blog-prod-network
     ```
     Ensure `api`, `web`, and `proxy` are all connected to `devops-blog-prod-network`.
  3. Inspect Nginx error log:
     ```bash
     docker logs devops-blog-prod-proxy-1 --tail 50
     ```
  4. Inspect API health check failures:
     ```bash
     docker logs devops-blog-prod-api-1 --tail 50
     ```

---

## 8. Deployment Record Template

Use this template to record production deployment verification and rollback events:

```text
=============================================================================
PRODUCTION DEPLOYMENT RECORD
=============================================================================
Date/Time (UTC): 
Release Trigger: [GitHub Actions CI / Manual Rollback]
Git Commit SHA: 
Triggered By: 

Images Deployed:
- API Image Tag: ghcr.io/amar1432/devops-blog-api:sha-<sha>
- API Manifest Digest: sha256:...
- Web Image Tag: ghcr.io/amar1432/devops-blog-web:sha-<sha>
- Web Manifest Digest: sha256:...

Coolify Deployment Status: [SUCCESS / FAILED]
Coolify Deployment UUID: 

Post-Deployment Verification:
- Smoke Test Result: [PASS / FAIL] (./scripts/smoke-test.sh)
- Homepage (HTTP 200): [PASS / FAIL]
- /api/health (status:ok, db:up): [PASS / FAIL]
- /api/posts: [PASS / FAIL]
- Uptime Kuma Status: [UP / DOWN]
- DB Volume devops-blog-prod-postgres-data Intact: [YES / NO]

Rollback Executed: [YES / NO]
- Rollback Target SHA: 
- Root Cause (if applicable): 
=============================================================================
```
