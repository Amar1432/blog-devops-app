# Milestone 3 — Docker & Containerization Specification

**Project:** DevOps Blog  
**Milestone:** 3  
**Status:** Planned  
**Previous milestones:** 0, 1 and 2 completed  
**Primary objective:** Containerize the existing React frontend, Node.js backend and PostgreSQL database using Docker.

---

## 1. Overview

The objective of this milestone is to understand Docker fundamentals by containerizing the existing DevOps Blog application.

The application is already implemented and tested locally.

We must not rewrite or unnecessarily modify its business logic.

The focus of this milestone is exclusively on Docker and containerization.

## 2. Learning objectives

By completing this milestone, the developer should understand:

- Docker architecture.
- Docker Engine and Docker Desktop.
- Docker images and containers.
- Dockerfiles and image layers.
- Docker image building and caching.
- Multi-stage builds.
- Container lifecycle management.
- Port mapping.
- Environment variables.
- Docker networking.
- Container-to-container communication.
- Docker volumes and persistent storage.
- Container logs and inspection.
- Image tags and registries.
- Docker image security basics.

## 3. Existing application architecture

The existing application consists of:

**Frontend**
- React
- Vite
- JavaScript

**Backend**
- Node.js
- Express
- Prisma ORM

**Database**
- PostgreSQL

**Repository**
- npm workspaces
- Monorepo structure

The implementation must inspect the existing repository before creating Docker configurations.

Do not assume package scripts, dependency locations or workspace configuration without inspecting the actual files.

## 4. Target Docker architecture

The final setup must contain three independent containers:

### Frontend container
- Production React build.
- Served using Nginx.
- Exposed on host port 8080.
- Internal container port 80.

### Backend container
- Node.js Express application.
- Exposed on host port 5000.
- Accepts runtime environment variables.
- Connects to PostgreSQL over a Docker network.

### Database container
- Official PostgreSQL Docker image.
- Exposed on host port 5432 for local development access.
- Uses a persistent named Docker volume.
- Stores database data independently of container lifecycle.

All three containers must connect through a custom Docker network named:

`devops-blog-network`

The frontend must be accessible from the browser at:

`http://localhost:8080`

The backend health endpoint must be accessible at:

`http://localhost:5000/api/health`

## 5. Dockerfile requirements

### 5.1 Frontend Dockerfile

Location:

`apps/web/Dockerfile`

Requirements:

1. Use a multi-stage Docker build.
2. Use a Node.js image for dependency installation and production build.
3. Use Nginx for serving production assets.
4. Copy only the necessary build output into the final image.
5. Avoid copying local `node_modules`.
6. Support React Router history fallback using Nginx configuration.
7. Configure the backend API URL through the appropriate Vite build-time variable.
8. Expose port 80.
9. Run the Nginx process using the standard container foreground configuration.

### 5.2 Nginx configuration

Location:

`apps/web/nginx.conf`

Requirements:

- Serve static React assets.
- Support client-side routing.
- Return `index.html` for frontend routes that do not match static files.
- Handle missing assets appropriately.
- Avoid unnecessary Nginx complexity.

### 5.3 Backend Dockerfile

Location:

`apps/api/Dockerfile`

Requirements:

1. Use a supported Node.js LTS base image.
2. Support the existing npm workspace configuration.
3. Install dependencies reproducibly using the existing lockfile.
4. Generate the Prisma client.
5. Include the Prisma schema and required migration files.
6. Start the Express server using the existing production start command.
7. Support runtime environment variables.
8. Run using a non-root user where compatible.
9. Avoid copying local `.env` files.
10. Avoid copying unnecessary development artifacts into the runtime image where practical.

Do not introduce an unnecessary backend build system.

## 6. Dockerignore requirements

Create appropriate `.dockerignore` configuration files.

Exclude:

- `node_modules`
- `.git`
- `.env`
- `.env.*`
- Test coverage output
- Logs
- Local build artifacts that are not needed
- OS-specific files
- Local editor configuration

Do not exclude required Prisma schema, migrations, package manifests or lockfiles.

## 7. PostgreSQL container requirements

Use the official PostgreSQL image.

Create a named volume:

`devops-blog-postgres-data`

Use environment variables for:

- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB

The database must:

- Persist data when its container is removed and recreated.
- Be reachable by the backend using Docker network DNS.
- Not expose credentials in committed files.
- Be accessible locally on port 5432 for development and inspection.

Do not use a bind mount for PostgreSQL data.

## 8. Docker networking requirements

Create a custom bridge network:

`devops-blog-network`

Connect the frontend, backend and PostgreSQL containers to this network.

The backend must connect to PostgreSQL using its container name:

`devops-db`

The database connection string must use:

`postgresql://USER:PASSWORD@devops-db:5432/DATABASE`

Use actual environment configuration rather than hardcoded credentials.

Understand and document:

- Why localhost behaves differently inside containers.
- How Docker container DNS works.
- How published ports work.
- Why containers on the same bridge network can communicate.

## 9. Container execution requirements

The milestone must not use Docker Compose.

All containers must be started independently using Docker commands.

Expected container names:

- `devops-blog-web`
- `devops-blog-api`
- `devops-db`

Document the following operations:

- Pull PostgreSQL image.
- Create Docker network.
- Create persistent volume.
- Build frontend image.
- Build backend image.
- Run database container.
- Run backend container.
- Run frontend container.
- Inspect running containers.
- View container logs.
- Execute commands inside containers.
- Stop containers.
- Remove containers.
- Recreate containers.
- Inspect networks.
- Inspect volumes.

## 10. Prisma migration requirements

The backend container must be able to connect to the PostgreSQL container.

Apply migrations using:

`npx prisma migrate deploy`

The command must run only after PostgreSQL is ready to accept connections.

Do not automatically execute production migrations every time the application starts.

Document the migration execution process.

Do not use `prisma db push` as the production migration strategy.

## 11. Environment configuration

Document all required environment variables.

Backend:

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- FRONTEND_URL

Frontend:

- VITE_API_URL

Database:

- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB

Important:

- Frontend Vite variables are build-time configuration.
- Backend secrets must be provided at container runtime.
- Never include secrets in Docker images.
- Never commit actual environment files.
- Do not place JWT secrets in frontend configuration.

## 12. Docker image requirements

Build images with meaningful names:

`devops-blog-web`

`devops-blog-api`

Use explicit tags such as:

`dev`

Document the difference between image tags and container names.

Inspect image layers and understand image size.

Do not optimize aggressively. The learning objective is understanding image construction and caching.

## 13. Practical experiments

Complete these experiments and document the results.

### Experiment 1: Container lifecycle

- Start a container.
- Inspect it.
- Stop it.
- Start it again.
- Remove it.
- Recreate it.

### Experiment 2: Container networking

- Inspect the custom network.
- Verify backend-to-database connectivity.
- Try using localhost inside the backend container.
- Observe why it fails.
- Correct it using the database container hostname.

### Experiment 3: Persistent storage

- Create a blog post.
- Stop and remove the PostgreSQL container.
- Recreate the database container with the same named volume.
- Verify that the blog post still exists.

### Experiment 4: Environment variables

- Start the backend with incorrect database credentials.
- Inspect logs.
- Correct the credentials.
- Restart the container.
- Verify database connectivity.

### Experiment 5: Docker image caching

- Build an image.
- Modify an application source file.
- Build again.
- Observe which layers are reused.
- Understand why Dockerfile instruction ordering matters.

### Experiment 6: Container failure

- Stop the backend container.
- Observe frontend behavior.
- Inspect backend logs.
- Restart the backend.
- Verify application recovery.

## 14. Security requirements

- Do not commit secrets.
- Do not include `.env` files in images.
- Use non-root application processes where practical.
- Use supported base image versions.
- Avoid unnecessary packages.
- Do not expose PostgreSQL to public networks.
- Do not use privileged containers.
- Use environment variables for credentials.

## 15. Documentation deliverables

Create:

`docs/DOCKER.md`

It must explain:

1. Docker fundamentals.
2. Docker architecture used in this project.
3. Dockerfile instructions used.
4. Frontend Docker build.
5. Backend Docker build.
6. PostgreSQL container setup.
7. Docker networking.
8. Docker volumes.
9. Container lifecycle commands.
10. Environment variable configuration.
11. Prisma migration execution.
12. Troubleshooting.
13. Practical experiment results.
14. Known limitations.

Also update the root README with basic Docker instructions.

## 16. Explicit exclusions

Do not implement:

- Docker Compose.
- GitHub Actions.
- CI/CD.
- GitHub Container Registry publishing.
- Coolify.
- Kubernetes.
- Terraform.
- Ansible.
- Cloud deployment.
- Production reverse proxy configuration.
- Advanced monitoring.
- Multi-server networking.

These belong to subsequent milestones.

## 17. Acceptance criteria

Milestone 3 is complete when:

- [ ] Frontend Docker image builds successfully.
- [ ] Backend Docker image builds successfully.
- [ ] PostgreSQL image runs successfully.
- [ ] All three containers run independently.
- [ ] Containers communicate through the custom network.
- [ ] Backend connects to PostgreSQL using container DNS.
- [ ] Prisma migrations run successfully.
- [ ] Frontend is accessible through Nginx.
- [ ] Backend health endpoint works.
- [ ] Database data survives container recreation.
- [ ] Container logs can be inspected.
- [ ] Docker images can be inspected.
- [ ] Container lifecycle commands are understood.
- [ ] Docker documentation is complete.
- [ ] Existing application functionality remains intact.

## 18. Definition of done

A developer should be able to:

1. Clone the repository.
2. Install Docker Desktop.
3. Build frontend and backend images.
4. Create the Docker network and database volume.
5. Start PostgreSQL.
6. Start the backend.
7. Apply Prisma migrations.
8. Start the frontend.
9. Open the blog application.
10. Log in and perform blog CRUD.
11. Stop and recreate containers without losing database data.

The entire workflow must be documented and executable using individual Docker commands.

The primary objective is to understand Docker fundamentals through practical implementation, not simply generate Dockerfiles.