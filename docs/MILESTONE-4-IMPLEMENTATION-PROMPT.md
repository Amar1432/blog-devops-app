# Implementation Prompt — Milestone 4: Docker Compose

You are acting as a Senior DevOps Engineer.

Your task is to implement Docker Compose orchestration for the existing DevOps Blog application.

Follow the requirements in:

`docs/MILESTONE-4-COMPOSE-SPEC.md`

## 1. Project context

The project has completed:

- Milestone 0: Development environment and Git.
- Milestone 1: Full-stack application development.
- Milestone 2: Automated testing.
- Milestone 3: Docker containerization.

The application already has working Dockerfiles for its frontend and backend.

Your job is to introduce Docker Compose without changing the application's business logic.

## 2. Inspect before implementing

Inspect:

- Existing Dockerfiles.
- Existing `.dockerignore`.
- Root package.json.
- Existing environment configuration.
- Prisma schema and migrations.
- `docs/DOCKER.md`.
- Existing Docker image names and build contexts.
- Existing PostgreSQL volume configuration.

Pay particular attention to:

- npm workspaces.
- Frontend build-time API URL.
- Backend `CORS_ORIGIN`.
- Database connection string.
- Existing Docker volume names.
- macOS port conflicts.

Present a short implementation plan before making changes.

## 3. Implementation requirements

Create:

- `compose.yaml`
- `.env.compose.example`
- `docs/DOCKER-COMPOSE.md`

Update:

- `.gitignore`
- `README.md`

Do not modify existing Dockerfiles unless a genuine compatibility issue requires it.

## 4. Compose implementation

Define three services:

- `web`
- `api`
- `db`

Configure:

- Correct build contexts.
- Existing Dockerfiles.
- Port mappings.
- Environment variables.
- Named Docker network.
- Named PostgreSQL volume.
- Service dependencies.
- Health checks.
- Restart policies.

Use the service DNS hostname `db` for PostgreSQL connectivity.

Do not use localhost for backend-to-database communication.

Use host ports 8080, 5001 and 5433 by default, with configurable overrides.

Bind database and API ports to the local host interface where appropriate.

Preserve the previous manually created Milestone 3 PostgreSQL volume. Do not accidentally reuse or delete it.

## 5. Environment management

Create `.env.compose.example`.

Use it to document all required environment variables.

Ensure:

- Actual secrets are not committed.
- Backend secrets are injected at runtime.
- Frontend API URL is passed at build time.
- `CORS_ORIGIN` matches the frontend origin.
- DATABASE_URL references the Compose database service.

Do not put credentials directly in compose.yaml.

## 6. Health checks and dependencies

Configure PostgreSQL readiness using `pg_isready`.

Configure backend health using its existing `/api/health` endpoint.

Configure frontend health using Nginx.

Use `depends_on` with `condition: service_healthy` where appropriate.

Explain the difference between container startup and service readiness.

Do not treat `depends_on` as a complete substitute for runtime error handling.

## 7. Database workflow

Keep migrations explicit.

Implement and document a workflow for:

1. Starting PostgreSQL.
2. Waiting for database health.
3. Running `prisma migrate deploy`.
4. Running the administrator seed script.
5. Starting the frontend and backend.

Do not automatically run migrations every time the backend starts.

## 8. Practical verification

Execute the experiments defined in the specification.

Verify:

- Complete stack startup.
- Service DNS.
- Health checks.
- Database persistence.
- Container recreation.
- Environment overrides.
- Restart policies.
- One-off migration execution.
- API and frontend availability.
- Existing blog CRUD functionality.

Run existing automated tests where practical.

Do not claim successful verification without actual execution.

If Docker is unavailable, explain what remains unverified.

## 9. Documentation

Create a detailed `docs/DOCKER-COMPOSE.md`.

Document the purpose of every major Compose configuration field.

Explain important commands and their effects.

Include troubleshooting examples and actual experiment results.

Update README with the shortest reproducible setup instructions.

## 10. Strict exclusions

Do not implement:

- GitHub Actions.
- CI/CD.
- GHCR.
- Coolify.
- Kubernetes.
- Cloud infrastructure.
- Linux server provisioning.
- Terraform.
- Ansible.
- Reverse proxy deployment.
- DNS or HTTPS configuration.
- Production deployment.

These are future milestones.

## 11. Final deliverables

Report:

- Files created and modified.
- Final Compose architecture.
- Service configuration.
- Network and volume configuration.
- Health-check behavior.
- Migration and seed commands.
- Startup and shutdown commands.
- Experiments performed.
- Verification results.
- Known limitations.

Do not begin Milestone 5 until all Milestone 4 acceptance criteria have been verified.

The primary objective is to teach Docker Compose through the existing application, not merely generate a YAML file.