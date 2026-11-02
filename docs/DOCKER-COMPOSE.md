# Docker Compose & Multi-Container Orchestration (Milestone 4)

This guide documents how the DevOps Blog is orchestrated using Docker Compose. It serves as both an educational walkthrough of multi-container fundamentals and an operational manual for developing and testing the application locally.

---

## 1. Introduction to Docker Compose

### What Docker Compose is
Docker Compose is a declarative tool for defining and running multi-container Docker applications. Instead of imperatively executing separate `docker run`, `docker network create`, and `docker volume create` commands with lengthy CLI flags, Compose allows you to specify your entire application architecture in a single YAML file (`compose.yaml`).

### Why Docker Compose exists
In Milestone 3, running the application required manual execution of several distinct steps:
1. Creating a custom bridge network.
2. Creating a persistent volume.
3. Starting PostgreSQL with runtime environment variables.
4. Polling until `pg_isready` succeeded.
5. Starting the Express backend with a database URL pointing to the database container.
6. Executing `npx prisma migrate deploy` and `node prisma/seed.js` inside the running backend.
7. Building and running the Nginx web container.

This manual workflow has significant drawbacks:
- **Error-prone**: Missing a parameter, typing the wrong network name, or starting containers out of order results in runtime failures.
- **Not reproducible**: Different team members might use varying port mappings, network names, or volume flags.
- **Hard to manage**: Stopping, restarting, or viewing logs across three independent containers requires orchestrating multiple CLI commands.

Docker Compose solves this by providing:
- **Declarative specification**: The intended state of services, networks, volumes, and health checks is committed to code.
- **Single-command lifecycle**: Entire environments can be created (`docker compose up -d`), inspected (`docker compose ps`), and destroyed (`docker compose down`) with single commands.
- **Dependency and readiness management**: Services can wait for upstream dependencies to become *healthy* (not merely started).

---

## 2. Docker CLI vs. Docker Compose

| Aspect | Docker CLI (Milestone 3) | Docker Compose (Milestone 4) |
| --- | --- | --- |
| **Model** | Imperative (step-by-step shell commands) | Declarative (`compose.yaml` defines desired state) |
| **Orchestration** | Manual startup order and timing | Automated dependency tree via `depends_on` and health checks |
| **Networking** | Manual network creation and manual attachment (`--network`) | Automatic network creation and service attachment |
| **Volumes** | Manual creation (`docker volume create`) | Declaratively defined named volume managed by Compose |
| **Configuration** | Command-line flags (`-e`, `-p`, `-v`) | Centralized in `compose.yaml` with `.env.compose` interpolation |
| **Service DNS** | Container names passed via `--name` | Service names (`web`, `api`, `db`) act as stable DNS hostnames |
| **One-off Tasks** | Running `docker exec` in existing containers | Running dedicated ephemeral containers via `compose run --rm` |
| **Teardown** | Individual `docker stop` and `docker rm` calls | `docker compose down` removes containers and networks in reverse order |

---

## 3. Architecture

The DevOps Blog Compose application consists of three services connected over an isolated bridge network, with the browser running outside Docker on the host machine:

```
+-------------------------------------------------------------------------------+
| Host Machine / Browser                                                        |
|                                                                               |
|   Frontend Access: http://localhost:8080                                      |
|   Direct API Access: http://localhost:5001/api                                |
|   Local DB Tool Access: localhost:5433 (host-only 127.0.0.1)                  |
+----------------------+---------------------------+----------------------------+
                       |                           |
        Port 8080:80   |             Port 5001:5000|
                       v                           v
+-------------------------------------------------------------------------------+
| Docker Network: devops-blog-compose-network                                   |
|                                                                               |
|   +--------------------------+       +------------------------------------+   |
|   | web                      |       | api                                |   |
|   | Service DNS: web         |       | Service DNS: api                   |   |
|   | Image: devops-blog-...   |       | Image: devops-blog-compose-api     |   |
|   | Port: 80                 |       | Port: 5000                         |   |
|   | Health: Nginx (wget)     |       | Health: /api/health (Node fetch)   |   |
|   +--------------------------+       +------------------+-----------------+   |
|                                                         |                     |
|                                    Internal DNS: db:5432|                     |
|                                                         v                     |
|                                      +------------------------------------+   |
|                                      | db                                 |   |
|                                      | Service DNS: db                    |   |
|                                      | Image: postgres:16-alpine          |   |
|                                      | Port: 5432                         |   |
|                                      | Health: pg_isready                 |   |
|                                      +------------------+-----------------+   |
|                                                         |                     |
|                                                         v                     |
|                                      +------------------------------------+   |
|                                      | Volume:                            |   |
|                                      | devops-blog-compose-postgres-data  |   |
|                                      +------------------------------------+   |
+-------------------------------------------------------------------------------+
```

### Critical Architecture Note: Browser vs. Container Networking
A common source of confusion in containerized web development is where code runs:
- The **frontend (React)** is packaged into static JavaScript and HTML files and served by Nginx (`web`). When a user visits `http://localhost:8080`, Nginx transfers those files to the user's browser.
- The JavaScript executes **inside the user's browser on the host**, NOT inside the `web` container.
- Consequently, client-side HTTP requests to the backend must be sent to the host-published port (`http://localhost:5001/api`), **not** to the internal Compose DNS name (`http://api:5000/api`), because the browser cannot resolve Docker's internal container DNS names.
- Conversely, the Express backend (`api`) runs **inside** the Docker network and connects to PostgreSQL directly over Docker DNS at `db:5432`.

---

## 4. Service Breakdown

### Service 1: `db`
- **Image**: Official `postgres:16-alpine`.
- **Internal Port**: `5432`.
- **Host Port Mapping**: `127.0.0.1:${DB_HOST_PORT:-5433}:5432`. Bound strictly to `127.0.0.1` so PostgreSQL is not exposed to the local network or public interfaces. Default host port 5433 prevents collisions with any PostgreSQL server running locally on macOS/Linux.
- **Environment**: Reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` interpolated from `.env.compose`.
- **Storage**: Mounts named volume `devops-blog-compose-postgres-data` to `/var/lib/postgresql/data`.
- **Health check**: Runs `pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB` every 5 seconds. `$$` escapes Compose interpolation so the variables expand inside the container shell at runtime.
- **Restart policy**: `unless-stopped`.

### Service 2: `api`
- **Build Context**: Repository root `.` (required to resolve hoisted root `package.json` and `package-lock.json` in this npm workspace monorepo).
- **Dockerfile**: `apps/api/Dockerfile`.
- **Internal Port**: `5000`.
- **Host Port Mapping**: `127.0.0.1:${API_HOST_PORT:-5001}:5000`. Default host port 5001 avoids conflict with macOS AirPlay Receiver on port 5000.
- **Environment**: Injected at runtime via `env_file: .env.compose`. No credentials or database URLs are baked into the Docker image.
- **Dependency**: `depends_on.db.condition: service_healthy`. The API container will not start until PostgreSQL has passed its `pg_isready` readiness probe.
- **Health check**: Executes `node -e "fetch('http://127.0.0.1:5000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"`. This probes Express and verifies actual database connectivity through Prisma (the endpoint checks database connection status and returns HTTP 503 if PostgreSQL is unreachable).
- **Restart policy**: `unless-stopped`.

### Service 3: `web`
- **Build Context**: Repository root `.`.
- **Dockerfile**: `apps/web/Dockerfile`.
- **Build Argument**: `VITE_API_URL=${VITE_API_URL:-http://localhost:5001/api}`. Vite statically embeds this URL into the JavaScript bundle during the build stage.
- **Internal Port**: `80`.
- **Host Port Mapping**: `${WEB_HOST_PORT:-8080}:80`.
- **Dependency**: `depends_on.api.condition: service_healthy`. Ensures the frontend only launches once the backend API is healthy and accepting requests.
- **Health check**: Executes `wget -q -O /dev/null http://127.0.0.1:80/ || exit 1` via BusyBox in Alpine.
- **Restart policy**: `unless-stopped`.

---

## 5. Compose Networks and Volumes

### Network: `devops-blog-compose-network`
- Defined under the top-level `networks:` block with explicit name `name: devops-blog-compose-network`.
- Uses the `bridge` driver.
- When an explicit name is supplied, Compose does not prepend the project directory name, providing a stable, isolated network namespace.
- Containers on this network communicate using service names (`db`, `api`, `web`) resolved by Docker's embedded 127.0.0.11 DNS resolver.

### Volume: `devops-blog-compose-postgres-data`
- Defined under the top-level `volumes:` block with explicit name `name: devops-blog-compose-postgres-data`.
- **Isolation from Milestone 3**: The Milestone 3 manually created volume was named `devops-blog-postgres-data`. By assigning the distinct name `devops-blog-compose-postgres-data`, Milestone 4 ensures complete isolation. The previous volume and its historical data remain completely untouched.
- **Destructive Warning**: Running `docker compose down` destroys containers and the network, but **preserves** the volume. Running `docker compose down -v` permanently deletes this named volume and all database records.

---

## 6. Environment Configuration

### Configuration Flow
Docker Compose separates configuration variables into two distinct mechanisms:
1. **Compose-level interpolation**: Compose reads `.env.compose` when `--env-file .env.compose` is passed. Variables such as `${DB_HOST_PORT}`, `${API_HOST_PORT}`, and `${POSTGRES_USER}` are interpolated directly into the `compose.yaml` definitions.
2. **Container runtime injection**: The `env_file: .env.compose` directive injects variables directly into the container's environment (e.g., Express reading `process.env.DATABASE_URL` and `process.env.JWT_SECRET`).

### `.env.compose.example` Reference
```bash
# --- PostgreSQL container ---
POSTGRES_USER=devops
POSTGRES_PASSWORD=replace-with-a-long-random-password
POSTGRES_DB=devops_blog

# --- Backend runtime ---
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://devops:replace-with-a-long-random-password@db:5432/devops_blog?schema=public
JWT_SECRET=replace-with-a-long-random-secret-at-least-16-chars
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:8080
ADMIN_NAME=Site Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password

# --- Frontend (build time) ---
VITE_API_URL=http://localhost:5001/api

# --- Host port overrides ---
WEB_HOST_PORT=8080
API_HOST_PORT=5001
DB_HOST_PORT=5433
```

### Build-Time vs. Runtime Variables
- `VITE_API_URL`: **Build-time only**. Vite evaluates `import.meta.env.VITE_API_URL` during `npm run build` and embeds the literal string value into the compiled assets in `/dist`. Changing `VITE_API_URL` in `.env.compose` will have **no effect** until you rebuild the image:
  ```bash
  docker compose --env-file .env.compose build web
  ```
- `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`: **Runtime only**. Read dynamically by the Express Node.js process upon startup. A container restart or recreation applies new values without rebuilding images.

---

## 7. Health Checks and Startup Dependencies

### Container Startup vs. Service Readiness
A container being in the `Running` state merely indicates that the initial process (PID 1) was spawned by the Linux kernel. It does **not** mean the service inside is ready to accept connections:
- When PostgreSQL starts, it must initialize its shared memory, load configuration, run write-ahead log recovery, and open its listening socket. Attempting to connect immediately results in `connection refused` or `database system is starting up`.
- When Express starts, it initializes its routes and establishes a database pool before listening on port 5000.

### Health Check Implementations
1. **PostgreSQL**:
   ```yaml
   healthcheck:
     test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
     interval: 5s
     timeout: 5s
     retries: 10
     start_period: 10s
   ```
2. **API**:
   ```yaml
   healthcheck:
     test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
     interval: 10s
     timeout: 5s
     retries: 5
     start_period: 15s
   ```
3. **Web**:
   ```yaml
   healthcheck:
     test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]
     interval: 10s
     timeout: 5s
     retries: 5
     start_period: 5s
   ```

### Dependencies
Compose uses `condition: service_healthy`:
```yaml
depends_on:
  db:
    condition: service_healthy
```
This guarantees that `api` will not start until `db`'s health check returns exit code 0. However, `depends_on` only controls **startup order**; it does not replace runtime resiliency (such as reconnection logic in application database clients when a database restarts mid-operation).

---

## 8. Database Migrations and Seeding Workflow

### Why Migrations Must Remain Explicit
Running database migrations automatically on every backend container startup is an anti-pattern:
1. **Concurrency hazards**: In multi-replica environments, multiple container instances starting simultaneously will attempt to apply migrations concurrently, causing lock contention or migration table corruption.
2. **Crash loops**: If a migration fails or requires manual intervention, the application container will continuously restart and fail.
3. **Lack of operational control**: Applying database schema changes should be a deliberate, trackable step in deployment pipelines.

### The Explicit Step-by-Step Setup
The documented, reproducible workflow for initializing a fresh database is:

```bash
# 1. Start only the database service in the background
docker compose --env-file .env.compose up -d db

# 2. Wait for PostgreSQL to become healthy
until [ "$(docker inspect --format='{{.State.Health.Status}}' devops-blog-compose-db-1 2>/dev/null)" = "healthy" ]; do
  sleep 1
done

# 3. Apply Prisma migrations using an ephemeral one-off container
docker compose --env-file .env.compose run --rm api npx prisma migrate deploy

# 4. Seed the initial admin account idempotently
docker compose --env-file .env.compose run --rm api node prisma/seed.js

# 5. Start the full application stack
docker compose --env-file .env.compose up -d
```

### Why `compose run --rm` is Used
`docker compose run --rm api <command>` creates a one-off container configured with the exact same environment, volumes, and network as the `api` service. The `--rm` flag guarantees that the container is deleted immediately upon exit, preventing abandoned stopped containers from accumulating.

---

## 9. Restart Policies Explained

In `compose.yaml`, all services specify:
```yaml
restart: unless-stopped
```

### Comparison of Policies
- **`no`** (default): Docker never restarts the container under any circumstance.
- **`always`**: Docker always restarts the container if it stops or crashes. If Docker Engine restarts, the container restarts automatically even if it was manually stopped before the restart.
- **`on-failure[:max-retries]`**: Restarts the container only if the process exits with a non-zero exit code.
- **`unless-stopped`**: Restarts the container on crashes and system reboots, **unless** the user explicitly stopped the container (e.g. via `docker stop` or `docker compose stop`). This is ideal for development and production workloads because intentional stops remain stopped.

---

## 10. Service DNS and Networking Mechanics

### The Internal DNS Server
Docker Engine runs an internal DNS server at `127.0.0.11` for all user-defined bridge networks. When a container looks up a hostname, the query is resolved against service names and container names on the network.

### Why `localhost` Fails Container-to-Container
Every container resides in its own isolated Linux network namespace with its own `lo` loopback interface (`127.0.0.1`).
- Inside `devops-blog-compose-api-1`, `localhost:5432` refers to port 5432 **inside the api container itself**. Because PostgreSQL is not running inside the `api` container, connection attempts fail immediately with `ECONNREFUSED`.
- The backend must address the database using `db:5432`, which resolves via `127.0.0.11` to the dynamic IP assigned to `devops-blog-compose-db-1`.

---

## 11. Lifecycle Command Reference

| Command | Action |
| --- | --- |
| `docker compose --env-file .env.compose build` | Builds or rebuilds all service images from their Dockerfiles. |
| `docker compose --env-file .env.compose up -d` | Creates networks, volumes, builds images if missing, and starts all containers in detached mode. |
| `docker compose --env-file .env.compose up -d db` | Starts only the specified service and its dependencies. |
| `docker compose --env-file .env.compose ps` | Displays the status, health state, and published ports of all services. |
| `docker compose --env-file .env.compose logs` | Views unified, interleaved log streams from all services. |
| `docker compose --env-file .env.compose logs -f api` | Follows real-time logs for the `api` service. |
| `docker compose --env-file .env.compose exec api sh` | Opens an interactive shell inside the running `api` container. |
| `docker compose --env-file .env.compose exec db psql -U devops -d devops_blog` | Opens a PostgreSQL interactive shell on the database service. |
| `docker compose --env-file .env.compose restart api` | Restarts the running `api` container without recreating it. |
| `docker compose --env-file .env.compose up -d --build api` | Rebuilds the `api` image and recreates the `api` container without stopping other services. |
| `docker compose --env-file .env.compose stop` | Stops running containers gracefully without removing them or the network. |
| `docker compose --env-file .env.compose down` | Stops containers and removes containers and networks. Persistent volumes remain intact. |
| `docker compose --env-file .env.compose down -v` | **DESTRUCTIVE**. Stops containers, removes networks, and deletes named persistent volumes. |
| `docker compose --env-file .env.compose config` | Parses, resolves, and prints the fully interpolated Compose configuration for debugging. |

---

## 12. Practical Experiment Results

The following 9 experiments were executed on macOS (Darwin arm64) using Docker Engine 28.3.3 and Docker Compose v2.

### Experiment 1: One-Command Startup
**Command**:
```bash
docker compose --env-file .env.compose up -d
```
**Observed Behavior**:
1. Docker Compose created `devops-blog-compose-network` and volume `devops-blog-compose-postgres-data`.
2. `db` container started first.
3. `api` container waited for `db` to pass health checks before starting.
4. `web` container waited for `api` to pass health checks before starting.
5. All three containers reported `(healthy)` in `docker compose ps`:
```
NAME                        IMAGE                     STATUS                    PORTS
devops-blog-compose-api-1   devops-blog-compose-api   Up 21 seconds (healthy)   127.0.0.1:5001->5000/tcp
devops-blog-compose-db-1    postgres:16-alpine        Up 3 minutes (healthy)    127.0.0.1:5433->5432/tcp
devops-blog-compose-web-1   devops-blog-compose-web   Up 16 seconds (healthy)   0.0.0.0:8080->80/tcp
```

### Experiment 2: Service DNS
**Commands & Outputs**:
```bash
# 1. Inspect DNS resolution from inside the api container
docker compose --env-file .env.compose exec api getent hosts db
# Output: 172.18.0.2      db

# 2. Test TCP connectivity to db:5432
docker compose --env-file .env.compose exec api node -e "require('net').connect(5432, 'db').on('connect', () => { console.log('TCP connect to db:5432 succeeded'); process.exit(0); })"
# Output: TCP connect to db:5432 succeeded

# 3. Test TCP connectivity to 127.0.0.1:5432 from inside api container
docker compose --env-file .env.compose exec api node -e "require('net').connect(5432, '127.0.0.1').on('error', (err) => { console.log('TCP connect to 127.0.0.1:5432 failed:', err.code); process.exit(0); })"
# Output: TCP connect to 127.0.0.1:5432 failed: ECONNREFUSED
```
**Conclusion**: `localhost` is scoped to the container's private network namespace. Containers must use service DNS names to communicate across the bridge network.

### Experiment 3: Persistent Storage Across Teardown
**Steps**:
1. Created post `"Experiment 3 Persistence Test"` (ID: `cmvz4hr6e0001s5010a7ohtot`) via `POST /api/posts`.
2. Executed `docker compose --env-file .env.compose down`.
   - Containers and network removed; volume `devops-blog-compose-postgres-data` preserved.
3. Restarted stack: `docker compose --env-file .env.compose up -d`.
4. Queried `GET /api/posts`:
```json
{"posts":[{"id":"cmvz4hr6e0001s5010a7ohtot","title":"Experiment 3 Persistence Test","slug":"experiment-3-persistence-test","author":{"name":"Site Admin"}}]}
```
**Conclusion**: Database records persist independently of container lifecycles as long as `down -v` is not invoked.

### Experiment 4: Database Health Checks and Recovery
**Steps**:
1. Stopped database: `docker compose --env-file .env.compose stop db`.
2. Probed `GET /api/health` from host:
```http
HTTP/1.1 503 Service Unavailable
{"status":"error","database":"down","uptime":31,"timestamp":"2026-11-02T10:36:11.488Z"}
```
3. Restarted database: `docker compose --env-file .env.compose start db`.
4. Probed `GET /api/health` after database health check passed:
```http
HTTP/1.1 200 OK
{"status":"ok","database":"up","uptime":40,"timestamp":"2026-11-02T10:36:19.845Z"}
```
**Conclusion**: The backend health check actively reflects database availability, and Express recovers automatically once PostgreSQL re-opens its socket.

### Experiment 5: Service Failure and Isolation
**Steps**:
1. Stopped API: `docker compose --env-file .env.compose stop api`.
2. Tested web frontend:
```bash
curl -s -I http://127.0.0.1:8080/
# Output: HTTP/1.1 200 OK (Nginx serving static SPA bundle)
```
3. Tested API:
```bash
curl -s http://127.0.0.1:5001/api/health
# Output: Failed to connect to 127.0.0.1 port 5001: Connection refused
```
4. Restarted API: `docker compose --env-file .env.compose start api`. Service returned HTTP 200 and resumed normal operations.
**Conclusion**: Independent micro-services fail in isolation. Frontend static serving continues uninterrupted even if the backend is temporarily offline.

### Experiment 6: Environment Configuration & Port Overrides
**Steps**:
1. Updated `WEB_HOST_PORT=8085` in `.env.compose`.
2. Ran `docker compose --env-file .env.compose config` and verified:
```yaml
ports:
  - mode: ingress
    target: 80
    published: "8085"
    protocol: tcp
```
3. Applied change: `docker compose --env-file .env.compose up -d web`.
4. Verified `curl -I http://127.0.0.1:8085/` returned HTTP 200.
5. Restored `WEB_HOST_PORT=8080` and re-applied with zero downtime to the database.

### Experiment 7: Restart Policies
**Steps**:
1. Inspected policy: `docker inspect devops-blog-compose-api-1 --format '{{.HostConfig.RestartPolicy.Name}}'` returned `unless-stopped`.
2. Sent `SIGKILL` directly to the container process: `docker kill -s SIGKILL devops-blog-compose-api-1`.
3. Checked container status 3 seconds later: Docker Engine automatically detected the crash and restarted the container (`Up 6 seconds (healthy)`).
4. Ran manual stop: `docker compose --env-file .env.compose stop api`.
5. Checked container status: The container remained cleanly in the `Stopped` state and did not restart, confirming the `unless-stopped` semantic contract.

### Experiment 8: One-Off Migration Execution
**Steps**:
1. Ran `docker compose --env-file .env.compose run --rm api npx prisma migrate status`.
2. Output:
```
Datasource "db": PostgreSQL database "devops_blog", schema "public" at "db:5432"
1 migration found in prisma/migrations
Database schema is up to date!
```
3. Ran `docker ps -a`: Verified no leftover migration containers remained.

### Experiment 9: Service Recreation
**Steps**:
1. Added a comment to `apps/api/src/server.js`.
2. Ran `docker compose --env-file .env.compose up -d --build api`.
3. Output showed BuildKit caching layers 1 through 8, invalidating only the source copy layer, and recreating container `devops-blog-compose-api-1`.
4. The database container `devops-blog-compose-db-1` was untouched and remained `Healthy`.
5. Queried `GET /api/posts` immediately: all existing posts and author relations were present.

---

## 13. Troubleshooting

| Symptom | Cause | Solution |
| --- | --- | --- |
| `address already in use: 5000` | macOS AirPlay Receiver occupies `0.0.0.0:5000`. | Leave `API_HOST_PORT=5001` in `.env.compose`. |
| `address already in use: 5432` | Local PostgreSQL service running on host. | Compose defaults to host port `5433` (`DB_HOST_PORT=5433`). |
| API container exits with code 1 | Missing environment variables or authentication error. | Check `docker compose logs api`. Ensure `POSTGRES_PASSWORD` in `.env.compose` matches `DATABASE_URL`. |
| Browser shows "Cannot reach the API" | Frontend bundle has old/wrong `VITE_API_URL`. | Update `VITE_API_URL=http://localhost:5001/api` and run `docker compose build web && docker compose up -d web`. |
| CORS error in browser console | `CORS_ORIGIN` does not match frontend origin. | Ensure `CORS_ORIGIN=http://localhost:8080` in `.env.compose` and restart `api`. |
| `table "Post" does not exist` | Migrations have not been run on fresh volume. | Execute `docker compose --env-file .env.compose run --rm api npx prisma migrate deploy`. |
| Login fails with valid credentials | Admin user has not been seeded into the database. | Execute `docker compose --env-file .env.compose run --rm api node prisma/seed.js`. |
| Container shows `(health: starting)` | Startup probe period in progress. | Allow `start_period` (5-15s) to elapse before inspecting status. |

---

## 14. Development vs. Production Considerations

This Docker Compose configuration is designed for local development and DevOps learning. It is **not** a production deployment configuration:

1. **Host Port Bindings**:
   - `db` exposes port 5433 to `127.0.0.1` for local GUI query tools (e.g. TablePlus, DBeaver, or psql). In production, database ports must **never** be published to the host.
2. **Secrets Storage**:
   - Storing secrets in a `.env.compose` plain-text file on disk is acceptable only on secure developer workstations. Production requires a secret management system (e.g. Docker Secrets, HashiCorp Vault, AWS Secrets Manager, or Kubernetes Secrets).
3. **Frontend API URL Immutability**:
   - Vite embeds `VITE_API_URL` into JavaScript at build time. For production deployments across staging/prod environments, an Nginx reverse proxy routing `/api` requests internally, or a runtime configuration injection pattern, is preferred.
4. **Volume Backups**:
   - Named Docker volumes reside locally on the Docker host (`/var/lib/docker/volumes/...`). Production databases require automated snapshots, WAL archiving, and offsite backups.
5. **TLS and Ingress**:
   - Traffic is unencrypted HTTP over port 8080. Production requires a reverse proxy (Traefik, Caddy, Nginx) handling TLS certificate termination and domain routing.
6. **Orchestration**:
   - Docker Compose manages single-host deployments without autoscaling, automated self-healing across nodes, or rolling blue/green deployments. Those capabilities belong to container orchestrators like Kubernetes or Docker Swarm (future milestones).

---

## 15. Known Limitations

- **Backend Image Size**: The `devops-blog-compose-api` image is ~917 MB because it retains the full hoisted workspace `node_modules` (including Prisma CLI and query engines) to support running `npx prisma migrate deploy` inside one-off containers.
- **Frontend Rebuild Requirement**: Because Vite bundles environment variables at compile time, altering `VITE_API_URL` requires rebuilding the image (`docker compose build web`).
- **Single Host Only**: Compose orchestrates containers on a single Docker daemon and does not support multi-server distribution.
