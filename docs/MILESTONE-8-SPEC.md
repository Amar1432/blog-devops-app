# Milestone 8 — Manual Deployment to a Linux Server

## Objective

Deploy the existing `devops-blog` application to the remote Ubuntu server using Docker Compose and the Docker images published to GitHub Container Registry (GHCR) in Milestone 6.

The deployment must be performed manually so that the learner understands each step and can troubleshoot it without relying on a deployment platform.

## Existing infrastructure

- Cloud provider: Oracle Cloud Infrastructure
- Operating system: Ubuntu Server, as documented in Milestone 7
- Container registry: GitHub Container Registry (GHCR)
- Images:
  - `ghcr.io/amar1432/devops-blog-api`
  - `ghcr.io/amar1432/devops-blog-web`
- Database: PostgreSQL 16
- Deployment tool: Docker Compose
- SSH access: Existing `devops-lab` / `devops-admin` aliases

## Deployment architecture

```text
                   Internet
                      |
                      |
               OCI Public IP
                      |
                UFW Firewall
                      |
               Docker Host
                      |
             Docker Compose
                      |
          +-----------+-----------+
          |                       |
      Web Container          API Container
       Nginx                   Node.js
          |                       |
          |                  PostgreSQL
          |                   Container
          |                       |
          +-----------------------+
                    |
              Docker Volume
             (PostgreSQL data)
```

For this milestone, expose the web application and API through separate host ports. Do not configure a reverse proxy or TLS yet.

## Phase 1 — Server readiness

1. Connect to the remote server using SSH.
2. Inspect OS version, CPU, memory, disk space, and uptime.
3. Inspect currently listening ports.
4. Check whether Docker Engine and the Docker Compose plugin are installed.
5. If missing, install Docker Engine and the Compose plugin using the official Docker installation instructions for Ubuntu.
6. Verify Docker with `docker --version` and `docker compose version`.
7. Verify the deployment user can execute Docker commands.
8. Understand the security implications of Docker group membership: membership effectively grants root-level control of the host.
9. Do not remove existing server configuration or unrelated resources.

**Important:** The documented server has approximately 1 GB RAM. Measure actual available memory before proceeding. Do not assume the application stack will fit comfortably. If resources are insufficient, stop and report the evidence before changing server size or purchasing anything.

## Phase 2 — GHCR image access

1. Understand public versus private GHCR packages.
2. Check whether both application packages are publicly pullable.
3. If private, authenticate using a least-privilege GitHub token with package read access.
4. Do not place tokens in shell history, Compose files, source control, or documentation.
5. Pull the API and web images.
6. Inspect image metadata and architecture.
7. Verify image tags and record the exact image digests used for deployment.

Prefer immutable image digests for reproducible deployment. If the existing workflow only provides `latest` and `sha-<short-sha>` tags, use the commit-specific tag and record its digest.

## Phase 3 — Production deployment configuration

Create a dedicated deployment directory, for example:

```text
/opt/devops-blog/
├── compose.yaml
├── .env
└── deployment-notes.md
```

Create a production Compose configuration that:

- Uses the GHCR images rather than building source code on the server.
- Uses a persistent named volume for PostgreSQL.
- Uses a private Compose network for internal service communication.
- Does not publish the PostgreSQL port publicly.
- Uses `db:5432` for the API's database connection.
- Uses a production API URL for the frontend build/runtime configuration, consistent with how the existing web image was built.
- Uses environment variables for database credentials and JWT secrets.
- Defines appropriate restart policies.
- Uses health checks where supported.
- Does not include development-only bind mounts or development commands.
- Does not hardcode secrets in the Compose file.

Review the existing application configuration before deciding how the frontend reaches the API. A Vite `VITE_*` variable is generally embedded at build time; changing a container environment variable at runtime does not automatically rewrite an already-built frontend bundle.

## Phase 4 — Database initialization

1. Start PostgreSQL.
2. Wait for the database health check to pass.
3. Run Prisma production migrations using the API image.
4. Seed initial data only if the deployment requires it and the seed script is safe to run.
5. Verify database connectivity from the API container.
6. Never use `prisma migrate dev` in production.
7. Never run destructive database reset commands.

## Phase 5 — Application deployment

1. Start the API and web services.
2. Inspect Compose service status.
3. Inspect container logs.
4. Verify the API health endpoint from the server.
5. Verify the frontend from the server.
6. Configure OCI ingress and UFW rules for only the ports required by this temporary deployment.
7. Test the application from a separate device or browser over the public IP.
8. Test login and basic blog functionality.
9. Verify PostgreSQL is not publicly reachable.

## Phase 6 — Operational experiments

Perform and document these experiments:

1. Stop and start the API container.
2. Restart the web container.
3. Restart the entire Compose stack.
4. Reboot the server and verify that services recover.
5. Create a blog post, restart the database container, and verify the post persists.
6. Inspect API logs when an invalid request is sent.
7. Temporarily use an incorrect database credential in a controlled test, observe the failure, and restore the correct value.
8. Pull a newer image and recreate the relevant service.
9. Explain the difference between restarting a container and recreating it with a new image.

Do not intentionally corrupt production data or expose credentials during experiments.

## Phase 7 — Deployment documentation

Create:

`docs/MANUAL-DEPLOYMENT.md`

Include:

- Deployment architecture
- Server prerequisites and resource measurements
- Docker installation and verification
- GHCR authentication and image pull commands
- Deployment directory structure
- Sanitized Compose configuration
- Environment variable names, without their secret values
- Database migration procedure
- Deployment and update procedure
- Health checks and troubleshooting
- Firewall rules and exposed ports
- Operational experiment results
- Reboot and persistence verification
- Rollback procedure
- Known limitations

## Acceptance criteria

- [ ] Docker Engine and Compose work on the remote server.
- [ ] Both application images are pulled from GHCR.
- [ ] Deployment uses registry images, not local source builds.
- [ ] PostgreSQL uses persistent storage.
- [ ] PostgreSQL is not exposed publicly.
- [ ] Prisma migrations run successfully.
- [ ] API and web containers start successfully.
- [ ] Application is reachable externally over the temporary HTTP deployment.
- [ ] Login and basic blog operations work.
- [ ] Data persists after container and server restarts.
- [ ] Logs and container health can be inspected.
- [ ] A newer image can be deployed.
- [ ] A rollback procedure is documented.
- [ ] No secrets are committed to GitHub.

## Out of scope

- Nginx reverse proxy
- Custom domain and DNS
- HTTPS / Let's Encrypt
- Coolify
- GitHub Actions remote deployment
- Kubernetes
- Terraform / Ansible
- Production-grade backup automation
- High availability

These will be covered in later milestones.