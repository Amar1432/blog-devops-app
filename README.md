# DevOps Blog

A small full-stack blogging application built as the foundation for a hands-on DevOps learning journey. Milestones 0–2 deliver a tested blog with a public reading experience and a JWT-protected admin area; Milestone 3 packages the frontend, backend and database as Docker containers; Milestone 4 orchestrates the multi-container stack with Docker Compose; Milestone 5 automates quality checks and Docker image builds with a GitHub Actions CI pipeline; Milestone 6 publishes version-traceable Docker images to GitHub Container Registry (GHCR).

## Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Frontend  | React 18 + Vite (JavaScript)            |
| Backend   | Node.js + Express (ES modules)          |
| Database  | PostgreSQL                              |
| ORM       | Prisma (schema + migrations)            |
| Auth      | JWT (Bearer tokens), bcrypt passwords   |
| Validation| Zod                                     |

## Monorepo layout

```
.
├── apps
│   ├── api                 # Express REST API
│   │   ├── prisma          # schema, migrations, seed script
│   │   ├── src
│   │   │   ├── config      # environment configuration
│   │   │   ├── controllers # request handlers
│   │   │   ├── lib         # Prisma client
│   │   │   ├── middleware  # auth, validation, errors
│   │   │   ├── routes      # Express routers
│   │   │   ├── utils       # AppError, slug helpers
│   │   │   └── validators  # Zod schemas
│   │   └── Dockerfile      # multi-stage backend image
│   └── web                 # React + Vite SPA
│       ├── src
│       │   ├── components
│       │   ├── lib         # API client, auth storage, formatting
│       │   └── pages
│       ├── Dockerfile      # Node build -> Nginx runtime
│       └── nginx.conf      # static serving + SPA fallback
├── docs
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── DOCKER-COMPOSE.md   # Docker Compose guide and experiments
│   ├── DOCKER.md           # Docker guide and experiments
│   ├── IMPLEMENTATION-PROMPT.md
│   ├── MILESTONE-0-1-SPEC.md
│   └── MILESTONE-3-DOCKER-SPEC.md
├── .dockerignore
├── .env.compose.example    # Docker Compose environment template
├── .gitignore
├── compose.yaml            # Docker Compose orchestration
└── package.json            # npm workspaces + root scripts
```

## Features

- Public post list and post detail pages (published posts only).
- Admin login with a seeded account; no public registration.
- JWT-protected admin dashboard.
- Create, edit, publish/unpublish and delete posts.
- Automatic, collision-safe slug generation.
- Request validation with Zod and consistent JSON error responses.
- Health endpoint that checks database connectivity.
- Prisma migrations and an idempotent admin seed script.
- Automated backend tests (unit, component, integration, API and end-to-end) with Jest and Supertest.
- Automated React tests with Vitest and Testing Library.
- Multi-stage Docker images for the web app and API, plus a PostgreSQL container (Milestone 3).

## Quick start

### Prerequisites

- Node.js 20 or newer (developed on Node 22)
- npm 10 or newer
- PostgreSQL 14 or newer running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
createdb devops_blog
```

### 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set:

- `DATABASE_URL` for your PostgreSQL user
- `JWT_SECRET` to a long random value
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the seeded admin

`apps/web/.env` defaults to `VITE_API_URL=http://localhost:4000/api`.

### 4. Apply migrations and seed the admin

```bash
npm run db:migrate
npm run db:seed
```

### 5. Run the application

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

Log in at `/login` with the admin credentials from `apps/api/.env`.

### 6. Run the backend tests

```bash
createdb devops_blog_test
cp apps/api/.env.test.example apps/api/.env.test
# edit the DATABASE_URL in apps/api/.env.test if needed
npm test
```

The suite refuses to run against any database whose name does not end in `_test`.

## Docker (Milestone 3)

The full guide — concepts, networking, volumes, migrations, experiments and troubleshooting — is in [docs/DOCKER.md](docs/DOCKER.md). No Docker Compose is used.

### 1. Create the network and persistent volume

```bash
docker network create devops-blog-network
docker volume create devops-blog-postgres-data
```

### 2. Set local, non-committed credentials

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

### 3. Build both images from the repository root

The root context is required because this is an npm workspace monorepo.

```bash
docker build -f apps/web/Dockerfile -t devops-blog-web:dev \
  --build-arg VITE_API_URL=http://localhost:5000/api .

docker build -f apps/api/Dockerfile -t devops-blog-api:dev .
```

`VITE_API_URL` is embedded at build time, so changing it requires rebuilding the web image.

### 4. Start PostgreSQL

```bash
docker run -d --name devops-db --network devops-blog-network -p 5432:5432 \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -v devops-blog-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

until docker exec devops-db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 1; done
```

### 5. Start the API, migrate and seed

```bash
docker run -d --name devops-blog-api --network devops-blog-network -p 5000:5000 \
  -e NODE_ENV=production -e PORT=5000 \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@devops-db:5432/${POSTGRES_DB}?schema=public" \
  -e JWT_SECRET="$JWT_SECRET" -e JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
  -e CORS_ORIGIN=http://localhost:8080 \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" -e ADMIN_NAME="$ADMIN_NAME" \
  devops-blog-api:dev

docker exec devops-blog-api npx prisma migrate deploy
docker exec devops-blog-api node prisma/seed.js
```

Migrations are applied explicitly, not automatically at container startup.

### 6. Start the frontend

```bash
docker run -d --name devops-blog-web --network devops-blog-network -p 8080:80 devops-blog-web:dev
```

- Web: http://localhost:8080
- API health: http://localhost:5000/api/health
- PostgreSQL: `localhost:5432` (local development access; the API uses `devops-db:5432` internally)

> macOS note: AirPlay Receiver listens on port 5000. If publishing fails with `address already in use`, disable AirPlay Receiver (System Settings → General → AirDrop & Handoff) or publish another host port and rebuild the frontend with the matching `VITE_API_URL`.

## Docker Compose (Milestone 4)

The full guide — Compose concepts, multi-container architecture, health checks, restart policies, explicit migrations, 9 practical experiments, and troubleshooting — is in [docs/DOCKER-COMPOSE.md](docs/DOCKER-COMPOSE.md).

### 1. Configure environment variables

```bash
cp .env.compose.example .env.compose
```

Edit `.env.compose` to configure credentials (keep `DATABASE_URL` matching `POSTGRES_USER` and `POSTGRES_PASSWORD`).

### 2. Start PostgreSQL

```bash
docker compose --env-file .env.compose up -d db
```

Wait until `docker compose --env-file .env.compose ps db` reports `(healthy)`.

### 3. Apply migrations and seed the admin user

Run one-off API containers:

```bash
docker compose --env-file .env.compose run --rm api npx prisma migrate deploy
docker compose --env-file .env.compose run --rm api node prisma/seed.js
```

### 4. Start the complete application

```bash
docker compose --env-file .env.compose up -d
```

- Web application: http://localhost:8080
- API health check: http://localhost:5001/api/health
- PostgreSQL (host-only): `localhost:5433`

### 5. Stop services

```bash
# Stop and remove containers and network (preserves database volume)
docker compose --env-file .env.compose down

# Stop and remove everything including database volume (destructive)
docker compose --env-file .env.compose down -v
```

## Continuous Integration (Milestone 5)

A multi-job GitHub Actions pipeline runs on every pull request targeting `main` and on pushes to `main`. It automatically verifies:

- **Backend CI**: Node.js 22, npm dependency caching, Prisma client generation, ESLint for `apps/api`, database migrations, and Jest test suites running against an isolated PostgreSQL 16 service container.
- **Frontend CI**: Node.js 22, npm dependency caching, ESLint for `apps/web`, Vitest component tests, and production Vite bundle build with non-sensitive environment variables.
- **Docker Build Validation**: Builds both backend and frontend Docker images from repository root context to verify Dockerfile validity without publishing images.

The complete guide — CI concepts, workflow architecture, runner details, dependency caching, service containers, log inspection, branch protection, and 6 practical failure experiments — is in [docs/GITHUB-ACTIONS-CI.md](docs/GITHUB-ACTIONS-CI.md).

## Container Registry & Publishing (Milestone 6)

The CI/CD pipeline extends to automatically build and publish versioned Docker images to **GitHub Container Registry (GHCR)** using Docker Buildx and GitHub Actions caching.

### Published Image Repositories

- **Backend API**: `ghcr.io/amar1432/devops-blog-api`
- **Frontend Web**: `ghcr.io/amar1432/devops-blog-web`

### Tagging Policy

- `sha-<short-sha>`: Immutable, commit-traceable tag (e.g. `sha-a1b2c3d`) generated for every successful build on `main`.
- `latest`: Floating tag pointing to the most recent successful build on `main`.

### Pulling the Images

```bash
# Pull by latest tag
docker pull ghcr.io/amar1432/devops-blog-api:latest
docker pull ghcr.io/amar1432/devops-blog-web:latest

# Pull by commit SHA tag
docker pull ghcr.io/amar1432/devops-blog-api:sha-<short-sha>
docker pull ghcr.io/amar1432/devops-blog-web:sha-<short-sha>
```

> If packages are set to private, authenticate first via `echo $CR_PAT | docker login ghcr.io -u <username> --password-stdin`.

The complete guide — container registry fundamentals, Buildx, BuildKit caching, permission scoping, private/public package management, and 7 verification experiments — is in [docs/GHCR-IMAGE-PUBLISHING.md](docs/GHCR-IMAGE-PUBLISHING.md).

## Root scripts

| Script               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run lint`       | Lint the frontend and backend with ESLint        |
| `npm run lint:fix`   | Lint and automatically fix safe issues           |
| `npm run lint:api`   | Lint only the backend API                        |
| `npm run lint:web`   | Lint only the frontend web application           |
| `npm run dev`        | Run API and web dev servers together             |
| `npm run dev:api`    | Run only the API (Node `--watch`)                |
| `npm run dev:web`    | Run only the Vite dev server                     |
| `npm run build`      | Build the frontend for production                |
| `npm start`          | Start the API without the watcher                |
| `npm run db:migrate` | Create/apply a development Prisma migration      |
| `npm run db:deploy`  | Apply existing migrations (no prompts)           |
| `npm run db:seed`    | Create/update the admin user                     |
| `npm run db:studio`  | Open Prisma Studio                               |
| `npm run db:generate`| Regenerate the Prisma client                     |
| `npm test`           | Run the frontend and backend test suites         |
| `npm run test:unit`  | Run unit tests                                   |
| `npm run test:component` | Run middleware/component tests               |
| `npm run test:integration` | Run controller + database tests            |
| `npm run test:api`   | Run HTTP API tests                               |
| `npm run test:e2e`   | Run end-to-end lifecycle tests                   |
| `npm run test:coverage` | Run all backend tests with coverage           |
| `npm run test:web`   | Run the frontend tests (Vitest + RTL)            |

## Documentation

- [Development guide](docs/DEVELOPMENT.md) — setup, scripts, migrations, troubleshooting.
- [Testing guide](docs/TESTING.md) — test layers, database setup, coverage.
- [Docker guide](docs/DOCKER.md) — container concepts, builds, networking, volumes and experiments (Milestone 3).
- [Docker Compose guide](docs/DOCKER-COMPOSE.md) — multi-container orchestration, health checks, restart policies, and experiments (Milestone 4).
- [GitHub Actions CI guide](docs/GITHUB-ACTIONS-CI.md) — workflow design, service containers, caching, and CI failure experiments (Milestone 5).
- [GHCR publishing guide](docs/GHCR-IMAGE-PUBLISHING.md) — container registries, Buildx, BuildKit caching, tagging strategy, and package security (Milestone 6).
- [API reference](docs/API.md) — endpoints, payloads, error format.

## Scope

Milestones 0–6 cover the application, automated tests, standalone Docker containerization, Docker Compose orchestration, GitHub Actions CI, and GHCR image publishing. VPS deployment, Coolify, Kubernetes, cloud infrastructure, Redis, microservices, image uploads, comments, likes, public registration, and production reverse proxies are intentionally excluded and belong to later milestones.

## Known limitations

- Post content is plain text rendered with preserved whitespace; there is no Markdown editor.
- The post list is not paginated.
- There is a single admin role; every authenticated user has full access.
- `npm audit` reports **development-only** advisories (Prisma CLI and Jest tooling). They are not part of the running application; upgrading to Prisma 7 would resolve the Prisma one but is deferred to keep this milestone simple.
- The API Docker image is large (~917 MB) because it retains the Prisma CLI and workspace `node_modules` so migrations can run inside the container. Aggressive pruning was deliberately skipped; see [docs/DOCKER.md](docs/DOCKER.md#13-known-limitations).
- On macOS, AirPlay Receiver occupies port 5000; see the Docker guide for the workaround.
