# Docker & Containerization (Milestone 3)

This guide explains how the DevOps Blog is packaged and run with Docker. It is
written for learning: it covers the concepts behind each command, not just the
commands themselves.

No Docker Compose is used. Every container is created with an individual
`docker` command.

---

## 1. Docker fundamentals

| Term | Meaning in this project |
| --- | --- |
| **Docker Engine** | The daemon that builds images and runs containers. Docker Desktop provides it on macOS. |
| **Image** | An immutable, layered filesystem produced by a Dockerfile. Examples: `devops-blog-web:dev`, `devops-blog-api:dev`, `postgres:16-alpine`. |
| **Container** | A running (or stopped) instance of an image. Examples: `devops-blog-web`, `devops-blog-api`, `devops-db`. |
| **Dockerfile** | The recipe used to build an image. Each instruction normally creates a cached layer. |
| **Layer** | A read-only filesystem diff. Layers are reused between builds when their inputs do not change. |
| **Volume** | Docker-managed persistent storage that lives outside a container's writable layer. |
| **Network** | A private virtual network. Containers on the same user-defined bridge network can resolve each other by name. |
| **Registry** | A store for images (Docker Hub by default). `postgres:16-alpine` is pulled from Docker Hub. |
| **Port mapping** | `-p HOST:CONTAINER` publishes a container port on the host. |

An image tag (`devops-blog-api:dev`) and a container name (`devops-blog-api`)
are different namespaces: many containers can run from the same image, and an
image can have many tags.

---

## 2. Architecture used here

```
Browser (host)
   |  http://localhost:8080
   v
+---------------------------+        +---------------------------+
| devops-blog-web           |        | devops-blog-api           |
| nginx:1.27-alpine         |        | node:22-bookworm-slim     |
| port 80 -> host 8080      |        | port 5000 -> host 5000    |
+---------------------------+        +-------------+-------------+
                                                   | devops-db:5432
                                                   v
                                     +---------------------------+
                                     | devops-db                 |
                                     | postgres:16-alpine        |
                                     | volume: devops-blog-      |
                                     | postgres-data             |
                                     +---------------------------+
```

All three containers are attached to the user-defined bridge network
`devops-blog-network`.

The browser is **outside** the Docker network. It reaches the API through the
published host port, which is why the production frontend is built with:

```
VITE_API_URL=http://localhost:5000/api
```

The API reaches the database **inside** the network, using the container name:

```
postgresql://USER:PASSWORD@devops-db:5432/devops_blog?schema=public
```

---

## 3. Repository changes

| File | Purpose |
| --- | --- |
| `.dockerignore` | Keeps `node_modules`, build output, Git data and env files out of the build context. |
| `apps/web/Dockerfile` | Multi-stage React build, served by Nginx. |
| `apps/web/nginx.conf` | Static serving, SPA fallback, asset caching/404 behavior. |
| `apps/api/Dockerfile` | Workspace-aware Node build, Prisma client generation, non-root runtime. |
| `docs/DOCKER.md` | This guide. |

No application source, business logic, schema or dependency version was
changed.

### Why the build context is the repository root

This is an npm **workspace** monorepo. Dependencies are hoisted to the root
`node_modules` and the root `package-lock.json` is the only lockfile. Building
from `apps/api` or `apps/web` alone would not see the workspace or the lockfile.

Therefore both images are built with the repository root as the context:

```bash
docker build -f apps/web/Dockerfile -t devops-blog-web:dev .
docker build -f apps/api/Dockerfile -t devops-blog-api:dev .
```

Docker only reads a `.dockerignore` **at the build-context root**, so there is
one root `.dockerignore` rather than one per app.

---

## 4. Dockerfile instructions used

| Instruction | What it does here |
| --- | --- |
| `FROM ... AS build` | Starts a named build stage. The frontend uses `node:22-bookworm-slim` then `nginx:1.27-alpine`; the API uses Debian slim for both stages. |
| `WORKDIR` | Sets the working directory for later instructions. |
| `COPY` | Copies manifests first (cacheable dependency layer), then source. |
| `RUN` | Executes `npm ci`, `prisma generate` or `vite build` and stores the result in a layer. |
| `ARG` | Build-time input. `VITE_API_URL` is passed here. |
| `ENV` | Runtime/dev environment inside the image. `VITE_API_URL` is exported before the Vite build so Vite embeds it. |
| `USER` | Switches to the unprivileged `appuser` (UID 10001) for the API. |
| `EXPOSE` | Documents the container port (80 / 5000). It does not publish it. |
| `CMD` | Default command: Nginx's foreground command for web, `node src/server.js` for the API. |

### Frontend build

1. Copy `package.json`, `package-lock.json`, `apps/web/package.json` and
   `apps/api/package.json`.
2. `npm ci` installs the exact lockfile tree.
3. Copy `apps/web` and run `vite build`.
4. Copy only `apps/web/dist` into the Nginx image.

The Node toolchain, source and `node_modules` never reach the runtime image.

`VITE_*` variables are **build-time**. Vite replaces `import.meta.env.VITE_API_URL`
with a literal string in the JavaScript bundle. Changing an environment variable
inside Nginx later does **not** change the already-built bundle; you must rebuild.

### Backend build

1. Install OpenSSL (Prisma 6 query engine dependency) in the build and runtime
   stages.
2. Copy the root and workspace manifests and run `npm ci`.
3. Copy only `apps/api/prisma` and `apps/api/src`.
4. Run `prisma generate`. The generated client lands in the hoisted
   `node_modules/.prisma` and `node_modules/@prisma/client`.
5. In the runtime stage, create the user **before** copying and use
   `COPY --chown=...`. Running `chown -R /app` after copying would create a new
   layer containing a full copy of the application (this was observed: it added
   ~451 MB).
6. Start with the existing production command: `node src/server.js`.

The runtime image intentionally keeps `node_modules` (including the Prisma CLI,
which is a devDependency) because migrations are run inside the container with
`npx prisma migrate deploy`. See [Known limitations](#13-known-limitations).

---

## 5. Environment variables

### Backend (runtime)

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | No | Use `production` in containers. |
| `PORT` | No | Container port. Set to `5000` to match the published port. |
| `DATABASE_URL` | **Yes** | Must use `devops-db`, not `localhost`. |
| `JWT_SECRET` | **Yes** | Minimum 16 characters; use a long random value. |
| `JWT_EXPIRES_IN` | No | Defaults to `1d`. |
| `CORS_ORIGIN` | No | Comma-separated allowed browser origins. Use `http://localhost:8080`. |
| `ADMIN_EMAIL` | Seed only | Admin account created by the seed script. |
| `ADMIN_PASSWORD` | Seed only | Minimum 8 characters. |
| `ADMIN_NAME` | No | Display name for the seeded admin. |

> The milestone spec lists `FRONTEND_URL`, but the current application reads
> **`CORS_ORIGIN`** (`apps/api/src/config/env.js`). Use `CORS_ORIGIN`.

### Frontend (build time)

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | Baked into the bundle. For Docker use `http://localhost:5000/api`. |

### Database (PostgreSQL container)

| Variable | Notes |
| --- | --- |
| `POSTGRES_USER` | Creates the role and database owner. |
| `POSTGRES_PASSWORD` | Required. Never commit it. |
| `POSTGRES_DB` | Database name, e.g. `devops_blog`. |

Secrets are provided at **runtime** with `-e` / shell variables. `.env` files
are excluded from the build context and never copied into images.

---

## 6. Build and run from scratch

### 6.1 Prerequisites

- Docker Desktop (or Docker Engine) running.
- Repository checked out.
- Free host ports: `5000`, `5432`, `8080`.

### 6.2 Set local credentials (do not commit these)

Export them in your shell, or put them in a local file that is **not tracked**
and `source` it. `.env` and `.env.*` are already gitignored.

```bash
export POSTGRES_USER=devops
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"
export POSTGRES_DB=devops_blog
export JWT_SECRET="$(openssl rand -hex 32)"
export JWT_EXPIRES_IN=1d
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD="$(openssl rand -hex 8)"
export ADMIN_NAME="Site Admin"
```

Use a URL-safe password (letters and numbers, or URL-encode it), because it is
embedded in `DATABASE_URL`.

### 6.3 Create the network and volume

```bash
docker network create devops-blog-network
docker volume create devops-blog-postgres-data
```

### 6.4 Pull PostgreSQL

```bash
docker pull postgres:16-alpine
```

### 6.5 Build the images

```bash
docker build -f apps/web/Dockerfile \
  -t devops-blog-web:dev \
  --build-arg VITE_API_URL=http://localhost:5000/api \
  .

docker build -f apps/api/Dockerfile -t devops-blog-api:dev .
```

### 6.6 Start PostgreSQL

```bash
docker run -d \
  --name devops-db \
  --network devops-blog-network \
  -p 5432:5432 \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -v devops-blog-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### 6.7 Wait for PostgreSQL

```bash
until docker exec devops-db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  sleep 1
done
```

### 6.8 Start the API

```bash
docker run -d \
  --name devops-blog-api \
  --network devops-blog-network \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@devops-db:5432/${POSTGRES_DB}?schema=public" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
  -e CORS_ORIGIN=http://localhost:8080 \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ADMIN_NAME="$ADMIN_NAME" \
  devops-blog-api:dev
```

Check the logs:

```bash
docker logs devops-blog-api
```

Expected:

```
Connected to the database
API listening on http://localhost:5000
```

### 6.9 Apply migrations and seed the admin (explicit, not at startup)

```bash
docker exec devops-blog-api npx prisma migrate deploy
docker exec devops-blog-api node prisma/seed.js
```

`migrate deploy` only applies committed migrations and is safe to re-run. The
seed script is idempotent (`upsert`).

### 6.10 Start the frontend

```bash
docker run -d \
  --name devops-blog-web \
  --network devops-blog-network \
  -p 8080:80 \
  devops-blog-web:dev
```

### 6.11 Verify

```bash
curl http://localhost:5000/api/health
curl -I http://localhost:8080/
open http://localhost:8080
```

Log in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 7. Daily lifecycle commands

```bash
# Show containers, images, networks and volumes
docker ps -a
docker images
docker network ls
docker volume ls

# Logs
docker logs devops-blog-api
docker logs -f devops-db

# Inspect
docker inspect devops-blog-api
docker inspect devops-blog-network
docker inspect devops-blog-postgres-data
docker port devops-blog-api

# Execute a shell / command inside a container
docker exec -it devops-blog-api sh
docker exec -it devops-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Stop and start without removing (data and DB volume stay)
docker stop devops-blog-api
docker start devops-blog-api

# Remove containers (named volume is NOT removed)
docker rm -f devops-blog-web devops-blog-api devops-db

# Remove images (only when no container uses them)
docker rmi devops-blog-web:dev devops-blog-api:dev

# Remove network / volume (destructive: volume deletion loses data)
docker network rm devops-blog-network
docker volume rm devops-blog-postgres-data
```

The containers have no restart policy. After a Docker Desktop restart, start
them again with `docker start devops-db devops-blog-api devops-blog-web` in that
order.

---

## 8. Networking explained

### Why `localhost` fails inside a container

Every container has its own network namespace. Inside `devops-blog-api`,
`localhost` / `127.0.0.1` means the API container itself, not the host and not
the database:

```
docker exec devops-blog-api node -e "require('net').connect(5432,'127.0.0.1')"
# ECONNREFUSED
```

The host's `localhost` is only relevant to processes running on the host (such as
your browser).

### How Docker DNS works

On a user-defined bridge network Docker runs an embedded DNS server. Container
names become DNS records:

```bash
docker exec devops-blog-api getent hosts devops-db
# 172.20.0.2      devops-db
```

That is why `DATABASE_URL` uses `devops-db:5432`. The IP can change when a
container is recreated; the name is stable.

### What published ports do

`-p 5001:5000` maps host port 5001 to container port 5000. The application
inside still listens on 5000 (`PORT=5000`). Port publishing is host-side NAT, not
part of the container's own networking.

### Why the frontend uses the host port, not `devops-blog-api`

The browser is not on the Docker network. It cannot resolve `devops-blog-api`.
It must use a host-published port, hence `http://localhost:5000/api`.

---

## 9. Volumes and persistence

PostgreSQL writes its cluster to `/var/lib/postgresql/data`. That path is mounted
from the named volume `devops-blog-postgres-data`.

- Removing the **container** does not remove a **named volume**.
- Recreating the container with the same volume restores the data.
- `docker volume rm devops-blog-postgres-data` is destructive.
- A bind mount was not used; the spec requires a named volume.

Verify the mount:

```bash
docker inspect devops-db \
  --format '{{range .Mounts}}{{.Type}} {{.Name}} -> {{.Destination}}{{println}}{{end}}'
```

---

## 10. Prisma migrations

- `prisma migrate deploy` applies committed SQL migrations. Use it in containers.
- `prisma migrate dev` is a development command and may create migrations.
- `prisma db push` is **not** the production migration strategy for this project.

The migration history is stored in `_prisma_migrations`:

```bash
docker exec devops-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'SELECT migration_name, finished_at FROM _prisma_migrations;'
```

Migrations are **not** run automatically when the API starts. Run them
explicitly after the database is ready:

```bash
docker exec devops-blog-api npx prisma migrate deploy
```

If the schema changes later, create a migration locally with
`npm run db:migrate`, commit it, rebuild the API image, then run
`migrate deploy` in the container.

---

## 11. Layers, caching and image size

Each Dockerfile instruction creates a layer. Docker reuses a cached layer when
the instruction and its inputs are unchanged.

Ordering matters. The Dockerfiles copy package manifests and run `npm ci` before
copying application source:

1. Change `apps/web/src/...` → only `COPY apps/web` and `vite build` re-run;
   `npm ci` stays cached.
2. Change `package-lock.json` → the `npm ci` layer is invalidated and everything
   after it re-runs.
3. Change `VITE_API_URL` → only the Vite build layer re-runs.
4. Change the backend `useradd` line → earlier dependency layers stay cached.

Observed image sizes after the final build:

```bash
docker images | grep devops-blog
# devops-blog-api:dev   917MB
# devops-blog-web:dev   76.2MB
```

The web image is small because only the `dist` output plus Nginx are copied. The
API image is larger because it retains `node_modules` (including the Prisma CLI
and query engines) so migrations can run inside it.

Inspect layers:

```bash
docker history devops-blog-api:dev
docker history devops-blog-web:dev
```

---

## 12. Practical experiment results

These were executed on Docker Desktop 28.3.3 (linux/arm64), PostgreSQL 16.15.

### Experiment 1 — Container lifecycle

- Inspected `devops-blog-web`: running, image `devops-blog-web:dev`, IP on the
  custom network.
- `docker stop` → connection refused on `localhost:8080`.
- `docker start` → HTTP 200 again.
- `docker rm -f` → container gone.
- Recreated from the same image → HTTP 200 with the same published port.

**Lesson:** images are durable; containers are disposable processes. Stopping is
not deleting.

### Experiment 2 — Networking

- `docker network inspect` showed `devops-db` at `172.20.0.2`,
  `devops-blog-api` at `172.20.0.3`, `devops-blog-web` at `172.20.0.4`.
- `getent hosts devops-db` resolved to `172.20.0.2` from the API container.
- TCP connect to `devops-db:5432` succeeded.
- TCP connect to `127.0.0.1:5432` failed with `ECONNREFUSED`.
- Using the container name in `DATABASE_URL` fixed connectivity.

**Lesson:** `localhost` is per-container; Docker DNS names are the stable
container-to-container addresses.

### Experiment 3 — Persistent storage

1. Created a published post (id and slug captured).
2. Confirmed it existed with `psql`.
3. `docker stop` + `docker rm` the database container.
4. Recreated it with the same `devops-blog-postgres-data` volume.
5. Restarted the API so Prisma reconnected.
6. The post was still present, including its content.
7. Deleted the test post afterwards.

**Lesson:** data lives in the volume, not in the container's writable layer.

### Experiment 4 — Environment variables

- Started the API with `wrong-password` in `DATABASE_URL`.
- The container exited with status 1 and logged:
  `Unable to connect to the database: Authentication failed ...`.
- Started an identical container with the correct password: it stayed up and
  `/api/health` returned 200.

**Lesson:** configuration is injected at runtime; credentials are not baked into
the image.

### Experiment 5 — Image caching

- Baseline build: every layer reported `CACHED`.
- Appended a temporary comment to `apps/web/src/index.css`.
- Rebuilt: `RUN npm ci` reported `CACHED`; `COPY apps/web` and the Vite build
  re-ran (`✓ built in 451ms`).
- Restored the file (empty `git diff`) and rebuilt the final image.

**Lesson:** instruction order determines cache reuse. Manifests before source,
expensive installs before cheap copies.

### Experiment 6 — Container failure and recovery

- Stopped `devops-blog-api`.
- Nginx continued serving the SPA (HTTP 200); API requests from the browser
  failed (connection refused, rendered as "Cannot reach the API").
- Logs showed a graceful `SIGTERM received, shutting down`.
- `docker start` restored the API; `/api/health` returned 200.

**Lesson:** containers are independent. A failing API does not stop the static
frontend, and stateful recovery is possible without rebuilding images.

---

## 13. Known limitations

1. **No Docker Compose** (by design for this milestone). Starting three
   containers requires the individual commands above.
2. **Backend image is large (~917 MB).** The Prisma CLI is a devDependency but is
   needed for `migrate deploy`, so the full workspace `node_modules` is retained.
   A future improvement is a separate migration image/job and a production-only
   dependency install; it was intentionally not optimized here.
3. **`VITE_API_URL` is baked in.** Changing the API URL requires rebuilding the
   frontend image.
4. **Port 5000 conflict on macOS.** AirPlay Receiver listens on `*:5000`. On the
   verification machine the API was published on host port **5001** and the
   frontend was built with `http://localhost:5001/api`. The commands in this
   document use the spec's `5000`; either disable AirPlay Receiver
   (System Settings → General → AirDrop & Handoff → AirPlay Receiver) or remap
   the host port consistently.
5. **Host port 5432 may hit a local PostgreSQL.** If local Postgres is running on
   `localhost:5432`, host tools may connect to it instead of the container. Use
   `docker exec devops-db psql ...` for inspection, or stop the local server /
   publish a different host port. Container-to-container traffic is unaffected.
6. **No TLS, reverse proxy, restart policy or orchestration.** These belong to
   later milestones.
7. **No healthcheck/readiness automation.** Wait for `pg_isready` manually before
   running migrations.
8. **Base image tags are pinned to minor lines** (`node:22-bookworm-slim`,
   `nginx:1.27-alpine`, `postgres:16-alpine`), not digests.

---

## 14. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `bind: address already in use` on `5000` | macOS AirPlay Receiver. Disable it or publish another host port and rebuild the frontend with the matching `VITE_API_URL`. |
| `bind: address already in use` on `5432` | A local PostgreSQL is running. Stop it or use another host port; the container still uses `devops-db:5432` internally. |
| API exits: `Authentication failed` | Wrong `POSTGRES_PASSWORD` or user/database mismatch. Recreate the container with correct values. |
| API exits: `Can't reach database server` | Database not ready or wrong hostname. Wait for `pg_isready`; use `devops-db`, never `localhost`. |
| API is up but queries fail with "table does not exist" | Migrations were not applied. Run `docker exec devops-blog-api npx prisma migrate deploy`. |
| Login fails after a fresh database | Seed the admin: `docker exec devops-blog-api node prisma/seed.js` (requires `ADMIN_*`). |
| Browser shows "Cannot reach the API" | Frontend bundle points at the wrong URL/port, or the API is down. Rebuild with the correct `VITE_API_URL`; check `docker logs devops-blog-api`. |
| Browser CORS error | `CORS_ORIGIN` does not include the frontend origin. Use `http://localhost:8080`. |
| `prisma generate` fails about OpenSSL | OpenSSL is missing. It is installed in both backend stages in the Dockerfile. |
| Permission denied writing files | The API runs as UID 10001 and only needs read access. Do not bind-mount writable paths unless required. |
| See what is inside an image | `docker run --rm -it --entrypoint sh devops-blog-api:dev` |

---

## 15. Security notes

- `.env` files are excluded by `.dockerignore` and are not copied into images.
- No credentials are hardcoded in the Dockerfiles, Nginx config or documentation.
- The API process runs as a non-root user.
- The frontend runtime contains only Nginx and static files.
- Database credentials are injected at runtime.
- PostgreSQL's published port is for local development only; do not expose it to
  a public network.
