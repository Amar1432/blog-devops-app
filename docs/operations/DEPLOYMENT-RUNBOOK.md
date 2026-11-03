# Deployment Runbook — Coolify Compose Workload Adoption (Milestone 11.4)

**Status:** Plan & Configuration Formulated — Pending Operator Review & Phase 11.5/11.6 Execution  
**Scope:** Adoption of the existing Docker Compose production stack into Coolify  
**Production changes made in this phase:** None  
**Secrets included in this document:** None (variable names and syntax contracts only)

---

## 1. Safety Contract

This runbook defines the exact configuration, identity mappings, and review gates required for Coolify to manage the production Docker Compose stack on the OCI workload server.

> [!CAUTION]
> **NO PRODUCTION CONTAINERS MAY BE STOPPED, RECREATED, DEPLOYED, OR MIGRATED IN THIS PHASE.**
> Implementation in this phase is restricted to configuration review, Compose validation, and runbook definition. The first deployment occurs only after Phase 11.5 publishes the `:production` images and configures CI webhooks.

---

## 2. Before / After Production Identity Table

All service names, explicit volume names, network identities, and port bindings must remain strictly identical before and after Coolify adoption:

| Entity Type | Compose Key | Current Runtime Name on OCI Host | Target Coolify Resource Name | Preserved? |
| :--- | :--- | :--- | :--- | :--- |
| **Project** | `name:` | `devops-blog-prod` | `devops-blog-prod` | **Yes** |
| **Service (DB)** | `db` | `devops-blog-prod-db-1` | `db` | **Yes** |
| **Service (API)** | `api` | `devops-blog-prod-api-1` | `api` | **Yes** |
| **Service (Web)** | `web` | `devops-blog-prod-web-1` | `web` | **Yes** |
| **Service (Proxy)** | `proxy` | `devops-blog-prod-proxy-1` | `proxy` | **Yes** |
| **Service (Certbot)** | `certbot` | `devops-blog-prod-certbot-1` | `certbot` | **Yes** |
| **Service (Monitoring)** | `uptime-kuma` | `devops-blog-prod-uptime-kuma-1` | `uptime-kuma` | **Yes** |
| **Database Volume** | `devops-blog-postgres-data` | `devops-blog-prod-postgres-data` | `devops-blog-prod-postgres-data` | **Yes** (Exact volume reused) |
| **Certbot Certs** | `certbot-etc` | `devops-blog-prod-certbot-etc` | `devops-blog-prod-certbot-etc` | **Yes** |
| **Certbot Webroot** | `certbot-www` | `devops-blog-prod-certbot-www` | `devops-blog-prod-certbot-www` | **Yes** |
| **Monitoring Volume** | `uptime-kuma-data` | `devops-blog-prod-uptime-kuma-data` | `devops-blog-prod-uptime-kuma-data` | **Yes** |
| **Internal Network** | `backend-network` | `devops-blog-prod-network` | `devops-blog-prod-network` | **Yes** (Bridge driver) |
| **Edge Ports** | `proxy.ports` | `80:80`, `443:443` | `80:80`, `443:443` | **Yes** (Only public listeners) |
| **Internal Ports** | `db`, `api`, `web` | No host ports mapped | No host ports mapped | **Yes** |
| **Loopback Port** | `uptime-kuma.ports` | `127.0.0.1:3001:3001` | `127.0.0.1:3001:3001` | **Yes** (Loopback strictly preserved) |

---

## 3. Coolify-Compatible Production Compose Specification

The reviewed specification in [deploy/compose.yaml](file:///Users/amarjeet/Desktop/devops/deploy/compose.yaml) features:
1. **Pre-built images:** Uses GHCR pre-built images exclusively (`build:` directives are forbidden).
2. **Controlled Production Tag:** Defaults to `:production` with override support for commit tags (`:sha-<commit>`).
3. **Forced Pull Policy:** Configured with `pull_policy: always` on `api` and `web` to guarantee that Docker pulls updated mutable `:production` layers from GHCR during automated releases.
4. **Explicit Volume & Network Naming:** Prevents Coolify or Docker Compose from prefixing custom hash IDs to the persistent database volume.

```yaml
name: devops-blog-prod

x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    logging: *default-logging
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER must be set in .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}
      POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB must be set in .env}
    volumes:
      - devops-blog-postgres-data:/var/lib/postgresql/data
    networks:
      - backend-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  api:
    image: ${API_IMAGE:-ghcr.io/amar1432/devops-blog-api:production}
    pull_policy: always
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend-network
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set in .env}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1d}
      CORS_ORIGIN: ${CORS_ORIGIN:-https://luffydev.duckdns.org,http://luffydev.duckdns.org}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      ADMIN_NAME: ${ADMIN_NAME:-Site Admin}
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:5000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  web:
    image: ${WEB_IMAGE:-ghcr.io/amar1432/devops-blog-web:production}
    pull_policy: always
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      api:
        condition: service_healthy
    networks:
      - backend-network
    environment:
      VITE_API_URL: ${VITE_API_URL:-/api}
    command:
      [
        "sh",
        "-c",
        "if [ -n \"$$VITE_API_URL\" ]; then sed -i \"s|http://localhost:5000/api|$$VITE_API_URL|g\" /usr/share/nginx/html/assets/*.js; fi && exec nginx -g 'daemon off;'",
      ]
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    depends_on:
      web:
        condition: service_healthy
      api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-etc:/etc/letsencrypt
      - certbot-www:/var/www/certbot
    networks:
      - backend-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  certbot:
    image: certbot/certbot:latest
    restart: "no"
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"
    volumes:
      - certbot-etc:/etc/letsencrypt
      - certbot-www:/var/www/certbot
    networks:
      - backend-network

  uptime-kuma:
    image: louislam/uptime-kuma:1.23.16
    restart: unless-stopped
    logging: *default-logging
    ports:
      - "127.0.0.1:${UPTIME_KUMA_HOST_PORT:-3001}:3001"
    volumes:
      - uptime-kuma-data:/app/data
    networks:
      - backend-network

networks:
  backend-network:
    name: devops-blog-prod-network
    driver: bridge

volumes:
  devops-blog-postgres-data:
    name: devops-blog-prod-postgres-data
  certbot-etc:
    name: devops-blog-prod-certbot-etc
  certbot-www:
    name: devops-blog-prod-certbot-www
  uptime-kuma-data:
    name: devops-blog-prod-uptime-kuma-data
```

---

## 4. Coolify Resource Setup (UI Procedure)

When configuring the resource in Coolify:

1. **Navigate to Projects:**
   - In Coolify dashboard, select **Projects** ➔ Default environment.
   - Click **+ New Resource**.
2. **Select Destination Server:**
   - Choose `oci-devops-blog-workload`.
3. **Select Source Type:**
   - Choose **Docker Compose** (via Public GitHub Repository: `https://github.com/Amar1432/blog-devops-app.git`).
   - Branch: `main`.
   - Compose location: `/deploy/compose.yaml`.
   - Base directory: `/deploy`.
4. **Environment Variables:**
   - Under the resource **Environment Variables** tab, copy the production variables from `/opt/devops-blog/.env` on the OCI host.
   - Required keys: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `VITE_API_URL`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `UPTIME_KUMA_HOST_PORT`.
5. **DISABLE Automatic Git Push Deployment:**
   - In Resource Settings, ensure **Auto Deploy** on commit/push is **DISABLED**.
   - *Why:* GitHub Actions must finish building and pushing images before Coolify deploys. Coolify must be triggered only by the authenticated webhook from CI.
6. **MANDATORY REVIEW ARTIFACT:**
   - Click **"Show Deployable Compose"** (or inspect generated Compose).
   - Verify that:
     1. Volume `devops-blog-postgres-data` retains `name: devops-blog-prod-postgres-data`.
     2. Network `backend-network` retains `name: devops-blog-prod-network`.
     3. Proxy listener remains only `80:80` and `443:443`.
     4. Coolify has not injected its own Traefik labels into the app containers.

### 4.1 GitHub Secrets & Webhook Configuration (Phase 11.5)

To connect GitHub Actions to Coolify without exposing credentials:

1. **Retrieve Deploy Webhook from Coolify:**
   - In Coolify, open the newly created `devops-blog-prod` Compose resource.
   - Go to **Webhooks** (or **General**).
   - Copy the **Deploy Webhook** URL (e.g., `https://<TUNNEL_DOMAIN>/api/v1/deploy?uuid=<RESOURCE_UUID>&force=false`).
   - If using authenticated API endpoints, create an API token under **Keys & Tokens ➔ API Tokens**.

2. **Add Secrets to GitHub Repository:**
   - In your GitHub repository (`https://github.com/Amar1432/blog-devops-app`), go to **Settings ➔ Secrets and variables ➔ Actions**.
   - Click **New repository secret**:
     - **Name:** `COOLIFY_WEBHOOK`
     - **Value:** The deploy webhook URL copied from Coolify.
   - (Optional) If your Coolify endpoint requires Bearer authentication:
     - **Name:** `COOLIFY_TOKEN`
     - **Value:** Your Coolify API Bearer token.

3. **Verify Trigger Isolation:**
   - Confirm **Auto Deploy** on commit in Coolify is **DISABLED**.
   - GitHub Actions will run tests, build images, publish `sha-<sha>` and `production` tags to GHCR, and only then call `COOLIFY_WEBHOOK`.

---

## 5. Production Cutover & Safety Runbook

When authorized to cut over Compose management to Coolify:

### Pre-Cutover Verification
1. Take a fresh PostgreSQL backup:
   ```bash
   /opt/devops-blog/scripts/backup-postgres.sh
   ```
2. Verify existing volume ID:
   ```bash
   docker volume inspect devops-blog-prod-postgres-data
   ```

### Cutover Execution
1. Trigger initial deployment via Coolify UI (**Deploy** button).
2. Monitor deployment logs in Coolify UI.
3. Observe container transition on OCI host:
   ```bash
   watch -n 2 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"'
   ```

### Post-Cutover Verification
1. Confirm PostgreSQL volume is still `devops-blog-prod-postgres-data` with unchanged mount time.
2. Confirm health checks for `db`, `api`, `web`, and `proxy` are green.
3. Execute smoke tests:
   ```bash
   curl -fsS https://luffydev.duckdns.org/api/health
   curl -fsS -o /dev/null -w "%{http_code}\n" https://luffydev.duckdns.org/
   ```

---

## 6. Rollback Procedure

If the Coolify-managed Compose stack fails:

1. **Application-Only Rollback (via Coolify or Compose):**
   - In Coolify Environment Variables, set `API_IMAGE` and `WEB_IMAGE` to the previous immutable release pair:
     ```bash
     API_IMAGE=ghcr.io/amar1432/devops-blog-api:sha-<previous-commit-sha>
     WEB_IMAGE=ghcr.io/amar1432/devops-blog-web:sha-<previous-commit-sha>
     ```
   - Redeploy in Coolify.
2. **Emergency Fallback (CLI direct):**
   - If Coolify control plane becomes unreachable, the workload host can be managed directly via Docker CLI in `/opt/devops-blog`:
     ```bash
     cd /opt/devops-blog
     docker compose up -d --pull always
     ```
   - Because the volumes and networks share identical explicit names, running Compose directly from `/opt/devops-blog` seamlessly takes over without data loss.

---

## 7. Acceptance Criteria for Phase 11.4

- [x] Compose configuration updated to default to `:production` with `pull_policy: always`.
- [x] Local Compose syntax validated with `docker compose config`.
- [x] Explicit named volumes and network verified to match live production IDs exactly.
- [x] Relative Nginx mount `./nginx/default.conf` verified.
- [x] Deployment runbook and before/after identity table documented.
- [x] Zero production containers stopped or recreated.
- [x] Operator review gate established.
