# Milestone 4 — Docker Compose & Multi-container Orchestration Specification

**Project:** DevOps Blog  
**Milestone:** 4  
**Status:** Planned  
**Previous milestones:** 0, 1, 2 and 3 completed

## 1. Overview

The objective of this milestone is to introduce Docker Compose and use it to manage the complete DevOps Blog application.

In Milestone 3, all containers were managed independently using Docker CLI commands.

In this milestone, we will move to declarative multi-container management using a single `compose.yaml` file.

The application must continue using the existing:

- React + Vite frontend
- Node.js + Express backend
- PostgreSQL database
- Prisma ORM
- Existing Dockerfiles
- Existing Docker network concepts
- Existing Docker image configurations

Do not rewrite application business logic.

## 2. Learning objectives

By completing this milestone, the developer should understand:

1. What Docker Compose is.
2. Why Docker Compose exists.
3. Docker Compose YAML structure.
4. Compose services.
5. Compose networks.
6. Compose volumes.
7. Service DNS.
8. Environment variable interpolation.
9. Build configurations.
10. Container dependencies.
11. Health checks.
12. Restart policies.
13. One-off containers.
14. Compose profiles.
15. Container lifecycle management.
16. Compose logs and debugging.
17. Docker Compose project naming.
18. Development versus production configuration concepts.

## 3. Target architecture

The final Compose application will consist of three services.

### Service 1: web

- Image built from `apps/web/Dockerfile`.
- Build context: repository root.
- Uses Nginx to serve React production assets.
- Container port: 80.
- Host port: 8080.
- Accessible at `http://localhost:8080`.

### Service 2: api

- Image built from `apps/api/Dockerfile`.
- Build context: repository root.
- Runs the existing Express application.
- Container port: 5000.
- Host port configurable through `API_HOST_PORT`.
- Default host port: 5001.
- Connects to PostgreSQL using the service hostname `db`.

### Service 3: db

- Uses the official `postgres:16-alpine` image.
- Container port: 5432.
- Host port configurable through `DB_HOST_PORT`.
- Default host port: 5433.
- Uses a named Docker volume.
- Must have a PostgreSQL readiness health check.

## 4. Repository changes

Create:

`compose.yaml`

Create:

`.env.compose.example`

Create:

`docs/DOCKER-COMPOSE.md`

Update:

- `.gitignore`
- `README.md`

Do not remove the existing Dockerfiles or `docs/DOCKER.md`.

## 5. Compose configuration requirements

The root `compose.yaml` must define:

- Project name.
- Frontend service.
- Backend service.
- PostgreSQL service.
- Named network.
- Named persistent volume.
- Build configurations.
- Published ports.
- Environment variables.
- Service dependencies.
- Health checks.
- Restart policies.

Use the modern Docker Compose specification.

Do not add the deprecated top-level `version` property.

Use the service names:

- `web`
- `api`
- `db`

Use a Compose-managed network named:

`devops-blog-compose-network`

Use a new Compose-managed named volume:

`devops-blog-compose-postgres-data`

Do not automatically reuse the previous manually created Docker volume. Preserve the old Milestone 3 volume and its data.

## 6. Build configuration

Both frontend and backend must continue using the existing Dockerfiles.

The build context must be the repository root because the application uses npm workspaces and a root package-lock.json.

Frontend build configuration:

- Dockerfile: `apps/web/Dockerfile`
- Build context: `.`
- Build argument: `VITE_API_URL`

Backend build configuration:

- Dockerfile: `apps/api/Dockerfile`
- Build context: `.`

Do not duplicate Dockerfile logic in Compose.

## 7. Environment configuration

Use a separate Compose environment file:

`.env.compose`

Provide an example:

`.env.compose.example`

Required variables:

### PostgreSQL

- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB

### Backend

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- CORS_ORIGIN
- ADMIN_NAME
- ADMIN_EMAIL
- ADMIN_PASSWORD

### Frontend

- VITE_API_URL

### Host ports

- API_HOST_PORT
- DB_HOST_PORT

Use these default host ports:

- Frontend: 8080
- API: 5001
- PostgreSQL: 5433

Keep internal container ports unchanged:

- Nginx: 80
- Express: 5000
- PostgreSQL: 5432

The API URL used by the frontend must be browser-accessible:

`http://localhost:5001/api`

The backend DATABASE_URL must use the internal Compose service hostname:

`db`

The CORS_ORIGIN must match:

`http://localhost:8080`

Important environment rules:

- Do not commit `.env.compose`.
- Commit `.env.compose.example`.
- Do not bake backend secrets into Docker images.
- Vite frontend variables are build-time values.
- Backend secrets are runtime values.
- Do not use `FRONTEND_URL` unless the actual application requires it.
- Inspect the existing backend environment configuration and use `CORS_ORIGIN`.

## 8. Service dependencies and health checks

### PostgreSQL health check

Configure a health check using:

`pg_isready`

Use the configured database username and database name.

Set reasonable values for:

- interval
- timeout
- retries
- start_period

### Backend dependency

The API service must depend on the database being healthy.

Use:

`depends_on` with `condition: service_healthy`.

Do not assume that starting a database container means PostgreSQL is immediately ready.

### Backend health check

Implement a container health check against:

`http://localhost:5000/api/health`

Use Node.js built-in functionality if curl or wget is unavailable in the backend image.

### Frontend health check

Check that Nginx responds successfully on its internal port 80.

### Frontend dependency

The frontend may depend on the API being healthy for startup ordering.

Document that this does not mean browser requests use Compose service DNS.

## 9. Restart policies

Use a reasonable restart policy for application services.

Recommended:

`unless-stopped`

Understand the difference between:

- no restart policy
- always
- unless-stopped
- on-failure

Document how restart policies behave after a container exits and after Docker restarts.

## 10. Database migrations and seeding

Do not automatically execute Prisma migrations every time the backend starts.

Migrations must remain explicit.

The documented first-time setup should follow:

1. Start the database service.
2. Wait for the database health check.
3. Run Prisma migrations through a one-off API container.
4. Seed the administrator using a one-off API container.
5. Start the API and frontend services.

Use commands equivalent to:

`docker compose run --rm api npx prisma migrate deploy`

`docker compose run --rm api node prisma/seed.js`

Verify that these commands use the same environment and database as the running application.

The seed script should remain idempotent.

Document how to apply future migrations before deploying updated backend code.

## 11. Required Compose commands

Document the following commands:

### Build

`docker compose build`

### Start everything

`docker compose up -d`

### Start individual service

`docker compose up -d db`

### View running services

`docker compose ps`

### View logs

`docker compose logs`

`docker compose logs -f api`

### Follow all logs

`docker compose logs -f`

### Execute commands

`docker compose exec api sh`

`docker compose exec db psql -U USER -d DATABASE`

### Restart a service

`docker compose restart api`

### Rebuild a service

`docker compose up -d --build api`

### Stop services

`docker compose stop`

### Stop and remove containers and network

`docker compose down`

### Remove containers, network and persistent data

`docker compose down -v`

Clearly explain that `down -v` is destructive and removes the Compose-managed database volume.

### View resolved Compose configuration

`docker compose config`

Explain why this command is useful for debugging environment variable interpolation.

## 12. Practical experiments

Complete and document the following.

### Experiment 1: One-command startup

Start the entire application using Compose.

Verify that all services become healthy.

### Experiment 2: Service DNS

From the API container:

- Resolve `db`.
- Connect to PostgreSQL using `db:5432`.
- Explain why `localhost` does not work.

### Experiment 3: Persistent storage

- Create a blog post.
- Execute `docker compose down`.
- Start the stack again.
- Verify that the post still exists.

Do not use `down -v` for this experiment.

### Experiment 4: Database health checks

- Stop the database.
- Observe service health.
- Restart the database.
- Observe recovery.

### Experiment 5: Service failure

- Stop the API.
- Verify that frontend static assets remain available.
- Observe frontend API errors.
- Restart the API.
- Verify recovery.

### Experiment 6: Environment configuration

Change a configurable host port.

Run `docker compose config`.

Restart the application.

Verify that the new host port is working.

### Experiment 7: Restart policies

Stop an application container and observe its restart behavior.

Compare manual stop with a process crash.

### Experiment 8: One-off migration container

Run migrations and seeding using `docker compose run --rm`.

Understand why these commands do not require permanently running another service.

### Experiment 9: Service recreation

Rebuild the API image after a harmless source change.

Recreate only the API service.

Verify that the database and its stored data remain available.

## 13. Development and production distinction

Explain that the current Compose configuration is intended for local learning and development.

It is not yet a production deployment configuration.

Document the following considerations:

- Host-bound ports are intended for local access.
- Secrets require appropriate management.
- Persistent storage requires backup.
- Database ports should not be exposed publicly.
- Frontend API configuration requires a rebuild when changed.
- Restart policies do not replace monitoring.
- Health checks do not replace application-level observability.

Do not create a production override or deploy to a cloud server in this milestone.

## 14. Explicit exclusions

Do not implement:

- GitHub Actions.
- CI/CD.
- GHCR.
- Coolify.
- Cloud deployment.
- Kubernetes.
- Terraform.
- Ansible.
- Traefik.
- Caddy.
- Public DNS.
- TLS certificates.
- Production server setup.
- Advanced monitoring.

These belong to future milestones.

## 15. Documentation requirements

Create `docs/DOCKER-COMPOSE.md`.

Include:

1. Docker Compose introduction.
2. Difference between Docker CLI and Compose.
3. Compose architecture.
4. Explanation of every service.
5. Explanation of volumes.
6. Explanation of networks.
7. Environment configuration.
8. Build process.
9. Startup process.
10. Migration and seeding process.
11. Health checks.
12. Restart policies.
13. Service DNS.
14. Container lifecycle commands.
15. Practical experiment results.
16. Troubleshooting.
17. Known limitations.
18. Development versus production distinction.

Update README with quick-start Compose commands.

## 16. Acceptance criteria

Milestone 4 is complete when:

- [ ] `compose.yaml` exists.
- [ ] Environment example exists.
- [ ] All three services are defined.
- [ ] Frontend image builds successfully.
- [ ] Backend image builds successfully.
- [ ] PostgreSQL starts successfully.
- [ ] Compose network is created.
- [ ] Persistent volume is created.
- [ ] PostgreSQL health check works.
- [ ] Backend waits for healthy database.
- [ ] Backend health check works.
- [ ] Frontend health check works.
- [ ] Prisma migrations run successfully.
- [ ] Administrator seeding works.
- [ ] Blog application functions through Compose.
- [ ] Data persists after `docker compose down` and `up`.
- [ ] Services can be inspected and debugged.
- [ ] Environment configuration works.
- [ ] Docker Compose documentation is complete.

## 17. Definition of done

A developer should be able to clone the repository, configure `.env.compose`, and start the complete application using Docker Compose.

The application must support:

- Public blog listing.
- Blog details.
- Administrator login.
- Blog creation.
- Blog editing.
- Blog deletion.
- Persistent PostgreSQL storage.

The developer should also understand how Compose manages services, networking, volumes, health checks and container lifecycle.

The goal is to understand declarative multi-container orchestration before moving into CI/CD.