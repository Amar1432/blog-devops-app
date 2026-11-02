# Manual Linux Server Deployment (Milestone 8)

This document provides a comprehensive operational guide to the manual production deployment of the `devops-blog` full-stack application on an Ubuntu Linux server using Docker Compose and pre-built container images published to GitHub Container Registry (GHCR).

---

## 1. Deployment Architecture

```text
                           Internet (Client Browser)
                                    |
                                    v
                     OCI Public IP: 129.154.253.114
                                    |
                   OCI VCN Ingress Rules (TCP 8080, 5000)
                                    |
                    Ubuntu Host Firewall (UFW)
                                    |
                  +-----------------+-----------------+
                  |                                   |
         Port 8080/tcp                       Port 5000/tcp
                  |                                   |
                  v                                   v
       +--------------------+              +--------------------+
       |   Web Container    |              |   API Container    |
       |     (Nginx)        |              |     (Node.js)      |
       | Static React Files |              | Express REST API   |
       +--------------------+              +--------------------+
                  |                                   |
                  |                                   | (Internal TCP 5432)
                  |    devops-blog-prod-network       v
                  +--------------------------> +--------------------+
                       (Private Bridge)        | Database Container |
                                               |  (PostgreSQL 16)   |
                                               +--------------------+
                                                         |
                                                         v
                                              Named Persistent Volume
                                        (devops-blog-prod-postgres-data)
```

### Architectural Principles:
1. **Zero Source Code on Server**: The remote production server contains no git clones, build tools, Node.js installations, or npm dependencies. All runtime artifacts are executed directly from pre-built OCI container images pulled from GHCR.
2. **Network Isolation**: PostgreSQL has **no host port mapping** (`ports: 5432`). It communicates strictly over the isolated bridge network `devops-blog-prod-network` and is unreachable from the public internet.
3. **Data Persistence**: Database storage is anchored to a Docker named persistent volume (`devops-blog-prod-postgres-data`) in `/var/lib/docker/volumes/`, surviving container stops, recreations, and host reboots.
4. **Decoupled Frontend & Backend**: The browser runs the client-side Single Page Application (SPA), sending API calls over the public internet to port 5000, while static assets are served from Nginx on port 8080.

---

## 2. Server Specifications & Resource Measurements

The target environment is an Oracle Cloud Infrastructure (OCI) Always Free Compute Instance.

| Component | Specification | Live Measured State |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 26.04.1 LTS (Resolute Raccoon) | Linux kernel `7.0.0-1013-oracle` (`x86_64`) |
| **Compute** | 2 vCPUs (AMD EPYC 7551 32-Core Processor) | Baseline load average ~0.05 |
| **System RAM** | 951 MiB (~1 GB physical RAM) | 390 MiB used by system daemons, 560 MiB available |
| **Configured Swap** | **2.0 GiB Swap File (`/swapfile`)** | Enabled with `vm.swappiness = 10`, persistent via `/etc/fstab` |
| **Storage** | 45 GB NVMe on `/dev/sda1` | 4.2 GB used (including Docker layers & swap), 40 GB free |
| **Public IPv4** | `129.154.253.114` | Routable internet address |
| **Deployment User** | `devopsadmin` (UID 1002) | Member of `sudo`, `docker`, `adm`, `systemd-journal` |

### Why 2 GB Swap was Configured:
A 1 GB RAM instance without swap has zero safety margin. Memory spikes during container extraction, image decompression, or Prisma migration schema introspection can instantly trigger the Linux kernel Out-Of-Memory (OOM) killer. Adding a 2 GB swap file on the ample 43 GB SSD guarantees stability without requiring paid infrastructure upgrades.

---

## 3. Docker Installation & Security Model

Docker Engine Community Edition and the Compose plugin were installed using Docker's official Ubuntu repository:

* **Docker Engine**: `v29.9.2` (build `a82e528`)
* **Docker Compose**: `v5.6.1`
* **Storage Driver**: `overlayfs` (`io.containerd.snapshotter.v1`)
* **Cgroup Driver**: `systemd`

### Security Implications of the `docker` Group:
Granting a Linux user membership in the `docker` group permits that user to communicate with the Docker daemon UNIX socket (`/var/run/docker.sock`) without `sudo`. 

> [!WARNING]
> Because Docker containers can mount arbitrary host directories (e.g. `docker run -v /:/host ...`), membership in the `docker` group is **effectively equivalent to root access**. This permission was granted exclusively to the dedicated non-root administrative account `devopsadmin`.

---

## 4. GHCR Image Registry Artifacts

The deployment pulls pre-built AMD64 container images published to GitHub Container Registry:

| Service | Image Repository | Tag Deployed | Deployed Digest |
| :--- | :--- | :--- | :--- |
| **Backend API** | `ghcr.io/amar1432/devops-blog-api` | `latest` | `sha256:294032db1aeef6049941a8b2cd6d8e03fdb064fa27d003ab4ea0a8800d5983da` |
| **Frontend Web** | `ghcr.io/amar1432/devops-blog-web` | `latest` | `sha256:05486d41b87c374869749eb1795564f2b9a43676a3d41a16bdfb1d0faba25214` |
| **Database** | `postgres` | `16-alpine` | Official library image |

Both GHCR packages are configured as **public**, allowing seamless pulls without storing long-lived personal access tokens on the server.

---

## 5. Production Deployment Files

The remote deployment configuration resides in `/opt/devops-blog/` (permissions `0750`, owned by `devopsadmin:devopsadmin`):

```text
/opt/devops-blog/
├── compose.yaml          # Mode 0644 (Compose service definition)
└── .env                  # Mode 0600 (Strictly protected credentials)
```

### Production Compose File (`deploy/compose.yaml`):

```yaml
name: devops-blog-prod

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
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
    image: ghcr.io/amar1432/devops-blog-api:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${API_HOST_PORT:-5000}:5000"
    networks:
      - backend-network
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set in .env}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1d}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8080}
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
    image: ghcr.io/amar1432/devops-blog-web:latest
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "${WEB_HOST_PORT:-8080}:80"
    networks:
      - backend-network
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:5000/api}
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

networks:
  backend-network:
    name: devops-blog-prod-network
    driver: bridge

volumes:
  devops-blog-postgres-data:
    name: devops-blog-prod-postgres-data
```

---

## 6. The Frontend Build-Time URL Challenge & Solution

### The Challenge:
Vite is a static compile-time bundler. Variables prefixed with `VITE_` are statically replaced with string literals during `npm run build`. The pre-built image in GHCR contained the hardcoded default `http://localhost:5000/api` inside its compiled `/usr/share/nginx/html/assets/index-*.js`.

When a client loads the web app on `http://129.154.253.114:8080` from their laptop, the browser executes the JavaScript on the client machine. Without intervention, the browser attempts to fetch `http://localhost:5000/api` on the client's local laptop, causing `ERR_CONNECTION_REFUSED`.

### The Solution:
Instead of rebuilding the image or compiling code on the server, we utilize an Alpine container boot command:
```bash
if [ -n "$VITE_API_URL" ]; then 
  sed -i "s|http://localhost:5000/api|$VITE_API_URL|g" /usr/share/nginx/html/assets/*.js
fi
exec nginx -g 'daemon off;'
```
This runs in a fraction of a second before Nginx starts. It dynamically updates the bundled API URL to `http://129.154.253.114:5000/api` based on the server `.env` file, leaving the immutable image in GHCR clean and universally deployable.

---

## 7. Sanitized Environment Configuration

Environment template stored at `deploy/.env.example`:

```bash
# --- PostgreSQL Database Credentials ---
POSTGRES_USER=devops_blog_user
POSTGRES_PASSWORD=generate_a_secure_random_db_password_here
POSTGRES_DB=devops_blog_prod

# --- Security & Authentication ---
JWT_SECRET=generate_a_secure_jwt_secret_at_least_16_characters_long
JWT_EXPIRES_IN=1d

# --- CORS & Networking ---
CORS_ORIGIN=http://129.154.253.114:8080,http://localhost:8080
VITE_API_URL=http://129.154.253.114:5000/api

# --- Initial Admin User (for seeding) ---
ADMIN_NAME=DevOps Admin
ADMIN_EMAIL=admin@devopsblog.local
ADMIN_PASSWORD=change_this_to_a_strong_password_min_8_chars

# --- Published Host Ports ---
API_HOST_PORT=5000
WEB_HOST_PORT=8080
```

---

## 8. Database Migration & Initialization Workflow

To initialize or upgrade the database schema in production without destroying data:

1. **Start PostgreSQL only**:
   ```bash
   cd /opt/devops-blog
   docker compose up -d db
   ```
2. **Wait for PostgreSQL healthcheck**:
   ```bash
   docker compose ps db
   # Wait until status is: Up (healthy)
   ```
3. **Run non-destructive production migrations**:
   ```bash
   docker compose run --rm api npx prisma migrate deploy
   ```
   * *Why `prisma migrate deploy`*: Reads existing migrations in `_prisma_migrations`, executes only pending SQL migration scripts, does not prompt interactively, and never drops tables or resets data.
4. **Seed initial admin user**:
   ```bash
   docker compose run --rm api node prisma/seed.js
   ```
   * *Why idempotent*: Uses `prisma.user.upsert` matching on `ADMIN_EMAIL`. Safe to run multiple times without duplicating or corrupting users.
5. **Start remaining application services**:
   ```bash
   docker compose up -d
   ```

---

## 9. Firewall Configuration (UFW & Cloud Ingress)

Security enforcement occurs at two independent layers:

### Layer 1: Host Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH management'
sudo ufw allow 8080/tcp comment 'DevOps Blog Web UI'
sudo ufw allow 5000/tcp comment 'DevOps Blog API'
sudo ufw enable
```

### Layer 2: Cloud Network Firewall (OCI VCN Security List)
OCI drops ingress packets at the cloud gateway before reaching the server. The VCN Security List has explicit Ingress Rules:
* **Protocol**: TCP
* **Source**: `0.0.0.0/0`
* **Destination Ports**: `8080, 5000, 22`

### PostgreSQL Public Isolation Verification:
```bash
devopsadmin@oracle-free-vnic:~$ ss -tulpn | grep 5432
# Output: Empty (Port 5432 is strictly bound to the Docker container IP)
```

---

## 10. Operational Experiments & Observed Results

Eight operational experiments were executed and verified on the live server:

### Experiment 1: Stop and Start API Container
* **Action**: `docker compose stop api`, verified external probe, then `docker compose start api`.
* **Observed**: Port 5000 closed immediately and external healthcheck failed. Upon `start`, Node.js resumed, re-queried Postgres, and returned HTTP 200 within 5 seconds. `db` and `web` remained running without interruption.

### Experiment 2: Restart Web Container
* **Action**: `docker compose restart web`.
* **Observed**: Nginx process restarted in place within 3 seconds. The backend API (uptime >11 minutes) and PostgreSQL were unaffected.

### Experiment 3: Full Stack Teardown & Data Persistence
* **Action**: `docker compose down` (removing all containers and the network), followed by `docker compose up -d`.
* **Observed**: Docker volume `devops-blog-prod-postgres-data` remained intact on disk. Upon recreation, `GET /api/posts` returned all previously created blog posts, confirming data persistence across complete container deletion.

### Experiment 4: Multi-User Post Creation & Persistence
* **Action**: Created posts `"First Production Post"` and `"Rise of the AI 🤖"` through authenticated API calls and the Web UI.
* **Observed**: Posts persisted across container restarts and full server reboot.

### Experiment 5: Centralized Logging on Invalid Request
* **Action**: Sent unauthorized request `POST /api/auth/login` with bad credentials.
* **Observed**: API returned HTTP 401 `{"error":{"code":"UNAUTHORIZED","message":"Invalid email or password"}}`. `docker compose logs api --tail=10` captured the event in real-time.

### Experiment 6: Controlled Failure Test (Invalid DB Password)
* **Action**: Modified `.env` with an incorrect `POSTGRES_PASSWORD` and recreated API.
* **Observed**: API crashed on startup (`Authentication failed against database server`), entering crash-restart loops. Once valid credentials were restored, container immediately returned to `healthy`.

### Experiment 7: Image Pull & Non-Disruptive Service Recreation
* **Action**: Executed `docker compose pull api` and `docker compose up -d --no-deps api`.
* **Observed**: Successfully verified that a single microservice can be pulled and recreated from GHCR without restarting or affecting other services.

### Experiment 8: Server Reboot & Automatic System Recovery
* **Action**: Executed `sudo reboot` on the host.
* **Observed**: Server completed boot cycle in 40 seconds. `systemd` started Docker, which automatically launched all 3 containers due to `restart: unless-stopped`. 2 GB swap mounted automatically via `/etc/fstab`. Healthchecks transitioned to `healthy` with zero human intervention.

---

## 11. Maintenance, Update & Rollback Procedures

### How to Deploy an Updated Image:
```bash
cd /opt/devops-blog
# 1. Pull the newest image from GHCR
docker compose pull

# 2. Run any new migrations
docker compose run --rm api npx prisma migrate deploy

# 3. Recreate containers with new image layers
docker compose up -d
```

### How to Roll Back to a Previous Version:
If a newly published image introduces a regression:
1. Update image tags in `/opt/devops-blog/compose.yaml` to point to a known good commit SHA:
   ```yaml
   image: ghcr.io/amar1432/devops-blog-api:sha-294032d
   ```
2. Recreate the service:
   ```bash
   docker compose up -d --force-recreate api
   ```

---

## 12. Known Limitations & Next Milestones

1. **Plain HTTP Only**: The application currently communicates over unencrypted HTTP on ports 8080 and 5000. TLS/HTTPS and Let's Encrypt certificates are not yet configured.
2. **Exposed Direct Ports**: The API is exposed directly on port 5000 rather than routed through a unified reverse proxy on port 80/443.
3. **No Domain Name**: Access relies on the raw public IP address (`129.154.253.114`).
4. **Manual Trigger**: Image deployment currently requires manual SSH commands rather than automated CI/CD continuous deployment.

These limitations will be addressed in subsequent milestones (Nginx reverse proxy, custom domains, HTTPS, and automated delivery pipelines).
