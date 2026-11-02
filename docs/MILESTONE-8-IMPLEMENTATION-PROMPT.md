# Implementation Prompt — Milestone 8: Manual Linux Server Deployment

You are my DevOps mentor and implementation assistant.

We are working on the `devops-blog` project. Milestones 0–7 are complete. Read the existing project documentation and configuration before making changes.

The objective is to prepare and execute a manual deployment of the application to my existing Ubuntu server using Docker Compose and images published to GHCR.

Read `MILESTONE-8-SPEC.md` first and follow it as the source of truth.

## Your responsibilities

1. Inspect the existing repository and understand the current Docker, Compose, CI, and GHCR configuration.
2. Explain the deployment architecture and each important decision before implementation.
3. Prepare the production deployment configuration.
4. Guide me through remote server operations one step at a time.
5. Help me understand and troubleshoot failures rather than hiding them behind automation.
6. Maintain accurate deployment documentation.

## Step 1 — Inspect the repository

Inspect these files if they exist:

- `package.json`
- `docker-compose.yml` / `compose.yaml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `.github/workflows/ci.yml`
- `.dockerignore`
- `.gitignore`
- Prisma schema and migration files
- Existing Docker and GHCR documentation

Understand:

- How the API reads its database URL.
- How JWT secrets are configured.
- How the frontend determines its API URL.
- Whether the frontend API URL is embedded at Vite build time.
- How the API health endpoint works.
- How Prisma migrations and seed scripts work.
- Which image tags are published by GitHub Actions.

Do not assume configuration based on previous documentation. Verify the actual files.

## Step 2 — Explain the deployment architecture

Before creating files, explain:

- What happens when Docker pulls an image from GHCR.
- Why the remote server does not need the application's source code.
- How Compose networking allows the API to communicate with PostgreSQL.
- How persistent volumes protect database data.
- Why PostgreSQL should not have a public host port.
- The difference between image, container, volume, and network.
- The difference between `docker compose restart` and `docker compose up -d --force-recreate`.

Use simple examples from this project.

## Step 3 — Prepare production Compose configuration

Create a dedicated production Compose file, preferably:

`deploy/compose.yaml`

The deployment must use GHCR images:

- `ghcr.io/amar1432/devops-blog-api`
- `ghcr.io/amar1432/devops-blog-web`

Requirements:

- Use an explicit image tag or digest.
- Do not use local `build:` instructions.
- Configure PostgreSQL with a named persistent volume.
- Keep PostgreSQL on an internal Compose network.
- Do not publish the PostgreSQL port.
- Configure API environment variables safely.
- Configure the frontend API URL correctly for the existing frontend implementation.
- Add suitable health checks and restart policies.
- Avoid development bind mounts.
- Avoid hardcoded credentials.
- Do not introduce unnecessary services.

If the existing frontend image has a build-time API URL that cannot work with the intended deployment architecture, explain the issue and propose the smallest correct solution. Do not silently assume that `VITE_API_URL` can be overridden at container runtime.

Create an `.env.example` containing placeholder values only. Ensure the real `.env` is ignored by Git.

## Step 4 — Prepare database operations

Determine the correct Prisma migration command from the actual project configuration.

The deployment procedure should:

1. Start PostgreSQL.
2. Wait for database health.
3. Execute `prisma migrate deploy` using the API image.
4. Run seed only if required and safe.
5. Start the API and web services.
6. Verify the result.

Do not run:

- `prisma migrate dev`
- `prisma migrate reset`
- Destructive database commands.

Explain the purpose of every migration command.

## Step 5 — Guide remote server setup

Before running any installation or deployment command:

- Explain what the command does.
- Explain why it is needed.
- Identify whether it changes server state.
- Tell me how to verify its result.

Inspect the existing Ubuntu server's resources first.

My documented server has approximately 1 GB RAM. Do not assume it can comfortably run the complete application stack. If memory or disk capacity is insufficient, stop and explain the evidence. Do not purchase, resize, or provision paid resources without asking me first.

Install Docker Engine and the Docker Compose plugin using official Ubuntu installation instructions if they are not already installed.

Do not make unnecessary changes to the existing SSH, UFW, user, or systemd configuration.

## Step 6 — GHCR authentication and image deployment

Check whether the GHCR packages are public or private.

If private:

- Explain how to create a least-privilege token with package read access.
- Never ask me to paste the token into chat.
- Never store credentials in Compose files or source control.
- Explain secure login using standard input rather than a command-line password argument.

Pull the images and inspect their metadata and architecture.

Record the image digests actually deployed.

## Step 7 — Deployment and verification

Guide me through the deployment incrementally.

Verify:

- PostgreSQL health.
- API container status.
- Web container status.
- API health endpoint.
- Frontend HTTP response.
- Database connectivity.
- Login functionality.
- Blog creation and retrieval.
- PostgreSQL is not publicly reachable.

If something fails, diagnose the actual failure using logs and container inspection before suggesting changes.

Do not claim success until the corresponding command or test has actually succeeded.

## Step 8 — Operational learning experiments

Guide me through the experiments defined in `MILESTONE-8-SPEC.md`.

For each experiment, explain:

1. What we are testing.
2. What we expect to happen.
3. Which command to run.
4. How to observe the result.
5. What the result teaches us.

Avoid experiments that risk data loss.

## Step 9 — Documentation

Create:

`docs/MANUAL-DEPLOYMENT.md`

Document the actual deployment, not an idealized deployment.

Include:

- Architecture
- Server resource measurements
- Docker setup
- GHCR image references and digests
- Deployment files
- Sanitized environment configuration
- Migration procedure
- Deployment and update commands
- Health checks
- Firewall configuration
- Troubleshooting
- Experiments and observed results
- Rollback procedure
- Known limitations

Never include private keys, tokens, passwords, JWT secrets, or database credentials.

## Working rules

- Teach me before asking me to execute commands.
- Work incrementally; do not implement everything in one giant operation.
- Ask for confirmation before disruptive server changes.
- Never disable SSH access or risk locking me out.
- Never expose PostgreSQL publicly.
- Never overwrite existing database volumes.
- Never run destructive database commands.
- Do not introduce Kubernetes, Terraform, Ansible, Coolify, or CI/CD deployment yet.
- Distinguish between verified results and assumptions.
- Keep the project aligned with the milestone specification.

## Completion

When all acceptance criteria are satisfied:

1. Summarize what we deployed.
2. Explain the most important concepts learned.
3. List any remaining limitations.
4. Update `docs/MANUAL-DEPLOYMENT.md`.
5. Confirm which acceptance criteria were actually verified.

Wait for my confirmation before moving to Milestone 9.