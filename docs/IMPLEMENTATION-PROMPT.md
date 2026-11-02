# Implementation Prompt — Milestone 3: Docker & Containerization

You are acting as a Senior DevOps Engineer and Full Stack Engineer.

Your task is to containerize the existing DevOps Blog application according to:

`docs/MILESTONE-3-DOCKER-SPEC.md`

## 1. Project context

The DevOps Blog application has already completed:

- Milestone 0: Development environment and Git workflow.
- Milestone 1: React + Node.js application development.
- Milestone 2: Automated testing and quality checks.

The existing application must be preserved.

Your task is to introduce Docker without unnecessarily changing the application architecture or business logic.

## 2. First inspect the repository

Before making changes:

1. Inspect the root package.json.
2. Inspect the npm workspace configuration.
3. Inspect package-lock.json.
4. Inspect the frontend package.json.
5. Inspect the backend package.json.
6. Inspect the Prisma schema.
7. Inspect the Prisma migrations.
8. Inspect the existing environment variables.
9. Inspect frontend API configuration.
10. Inspect existing scripts and documentation.

Present a short implementation plan before proceeding.

Identify any compatibility issues involving npm workspaces, Prisma, Node.js and Docker.

Do not assume that the frontend and backend can be built using independent package directories. Respect the existing monorepo structure.

## 3. Implementation principles

- Follow the milestone specification.
- Preserve existing application functionality.
- Use existing dependency versions.
- Use the existing package-lock.json.
- Avoid unnecessary dependencies.
- Prefer simple Docker configurations.
- Explain important Docker concepts as they are implemented.
- Never hardcode credentials.
- Never copy actual environment files into Docker images.
- Do not silently change application behavior.
- Do not introduce Docker Compose.

## 4. Implementation sequence

Work in the following order.

### Step 1: Prepare Docker configuration

Create appropriate `.dockerignore` files.

Explain why each excluded directory or file is excluded.

### Step 2: Dockerize the frontend

Create:

- `apps/web/Dockerfile`
- `apps/web/nginx.conf`

Requirements:

- Multi-stage build.
- Node.js build stage.
- Nginx runtime stage.
- React Router fallback support.
- Correct frontend API URL configuration.
- Small, practical runtime image.

Verify that frontend assets are served correctly.

### Step 3: Dockerize the backend

Create:

- `apps/api/Dockerfile`

Requirements:

- Compatible with the existing npm workspace.
- Reproducible dependency installation.
- Prisma client generation.
- Correct production startup command.
- Runtime environment variables.
- Non-root execution where practical.

Do not redesign the backend.

### Step 4: Build Docker images

Build the frontend and backend images.

Verify:

- Successful builds.
- Correct image names.
- Correct ports.
- Image contents.
- No leaked secrets.

Explain Docker layers and caching.

### Step 5: Start PostgreSQL

Use the official PostgreSQL image.

Create:

- Database container named `devops-db`.
- Persistent named volume `devops-blog-postgres-data`.
- Custom network `devops-blog-network`.

Configure database credentials using runtime environment variables.

### Step 6: Start the backend container

Connect it to the custom network.

Use the database container hostname in DATABASE_URL.

Publish backend port 5000.

Wait for PostgreSQL readiness before running Prisma migrations.

Apply migrations explicitly.

Do not automatically execute migrations every time the backend container restarts.

### Step 7: Start the frontend container

Connect it to the custom network.

Publish Nginx port 80 on host port 8080.

Verify frontend-to-backend API requests from the browser.

Remember that browser requests to localhost are different from requests made inside a Docker container.

### Step 8: Verify the complete application

Verify:

- Frontend loads.
- API health endpoint responds.
- Database connection works.
- Admin login works.
- Blog listing works.
- Blog creation works.
- Blog editing works.
- Blog deletion works.
- Unpublished posts remain private.

### Step 9: Run practical experiments

Execute the experiments from the milestone specification:

- Container lifecycle.
- Docker networking.
- Persistent storage.
- Environment variable failure.
- Image caching.
- Container failure and recovery.

Explain what happened and why.

### Step 10: Documentation

Create `docs/DOCKER.md`.

Update README.md with the Docker workflow.

Document every command required to reproduce the setup.

## 5. Important technical constraints

### No Docker Compose

Do not create:

- `compose.yaml`
- `docker-compose.yml`

Do not use Docker Compose commands.

Every container must be created and managed using individual Docker commands.

### Database persistence

Never store PostgreSQL data only inside the container's writable layer.

Use the named Docker volume specified in the milestone specification.

### Networking

The backend must use the PostgreSQL container hostname.

Do not use localhost for the database connection from inside the backend container.

### Frontend API configuration

Inspect the actual Vite configuration.

Remember that VITE_ variables are generally embedded into the production frontend during the build.

Do not assume that changing a runtime environment variable inside Nginx automatically changes the already-built JavaScript bundle.

Use the simplest correct configuration for this learning milestone.

### Prisma

Inspect the installed Prisma version and existing migration structure.

Use the appropriate client generation and migration commands.

Do not modify the database schema unless required by the existing application.

## 6. Verification requirements

Do not claim completion without executing available verification steps.

Run:

- Docker image builds.
- Container startup checks.
- API health checks.
- Database connectivity checks.
- Prisma migration checks.
- Frontend availability checks.
- Existing automated tests.
- Existing lint and build commands where practical.

If Docker is unavailable in the environment, explain exactly which checks could not be performed and provide the commands for the developer to execute locally.

## 7. Final deliverables

Provide:

1. Frontend Dockerfile.
2. Backend Dockerfile.
3. Nginx configuration.
4. Dockerignore configuration.
5. Working Docker build commands.
6. Working container startup commands.
7. Docker networking commands.
8. PostgreSQL volume configuration.
9. Prisma migration instructions.
10. Docker documentation.
11. Updated README.
12. Verification results.
13. Known limitations.

## 8. Do not implement future milestones

Strictly exclude:

- Docker Compose.
- GitHub Actions.
- CI/CD.
- GHCR.
- Coolify.
- Linux server provisioning.
- Cloud deployment.
- Kubernetes.
- Terraform.
- Ansible.
- Advanced monitoring.

These will be implemented later.

## 9. Final response

After implementation, report:

- What files were created or changed.
- How each container works.
- How to build and start the application.
- How containers communicate.
- How database persistence works.
- What experiments were completed.
- Which checks passed or failed.
- Any remaining issues.

Do not begin Milestone 4 until Milestone 3 acceptance criteria have been verified.

Your goal is not just to containerize the application. Your goal is to help the developer understand Docker by implementing and experimenting with it.