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

### Step 1: Pin Target Image in Environment or CLI
You can either pass the override as a command prefix or edit `/opt/devops-blog/.env`:

#### Option A: Immediate CLI Execution
```bash
cd /opt/devops-blog

# Rollback API container to a known-good commit SHA
API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<known-good-sha> docker compose pull api
API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<known-good-sha> docker compose up -d api
```

#### Option B: Persistent Pinning in `.env`
Edit `/opt/devops-blog/.env`:
```bash
API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<known-good-sha>
WEB_IMAGE=ghcr.io/amar1432/devops-blog-web:sha-<known-good-sha>
```
Then execute:
```bash
docker compose pull api web
docker compose up -d api web
```

### Step 2: Confirm Container Recreation
Verify that only the target container was updated and reached healthy state:
```bash
docker compose ps api web
```
The database and reverse proxy remain unaffected.

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

## 7. Failure Handling During Rollback

If a rollback image cannot be pulled or fails to start:
1. **Missing Image on Registry**:
   Check if the image tag exists on GHCR (`https://github.com/Amar1432/devops-blog/pkgs/container/devops-blog-api`). If an old SHA was pruned from GHCR, select the local image digest from `docker images` on the server and deploy via digest reference (`API_IMAGE=ghcr.io/amar1432/devops-blog-api@sha256:...`).
2. **Container Crashloop on Startup**:
   Inspect startup logs: `docker compose logs --tail=100 api`.
   Verify environment variables in `.env`.
3. **Database Incompatibility**:
   If an application change included a non-backwards-compatible schema migration that prevents older application images from reading the database, an application-only rollback will fail. In this scenario, refer to the full disaster recovery runbook in [`BACKUP-AND-RESTORE.md`](./BACKUP-AND-RESTORE.md) to restore the database to the pre-migration backup.
