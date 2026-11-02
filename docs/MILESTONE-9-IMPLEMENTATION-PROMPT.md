# Implementation Prompt — Milestone 9

Act as my DevOps mentor and implementation assistant for the `devops-blog` project.

Milestones 0–8 are complete. Read the existing project documentation, especially:

- `docs/MANUAL-DEPLOYMENT.md`
- `docs/LINUX-SERVER-ADMINISTRATION.md`
- Existing Compose configuration
- Frontend Dockerfile
- Backend Dockerfile
- Existing Nginx configuration
- Prisma and API configuration

Read `MILESTONE-9-SPEC.md` before implementation.

## Step 1 — Inspect and explain

Inspect the current deployment architecture.

Explain:

- How DNS resolves the domain.
- Why we need a reverse proxy.
- How Nginx forwards requests to containers.
- How TLS certificates are obtained.
- How the browser communicates with the API using a single origin.

Do not modify anything yet.

## Step 2 — Domain readiness

Ask me which domain I own and intend to use.

Do not purchase a domain or change registrar settings without my approval.

Inspect DNS records and verify that the domain points to the server before attempting certificate issuance.

Do not invent a domain name or use a placeholder in actual commands.

## Step 3 — Prepare Nginx configuration

Create a dedicated Nginx reverse proxy configuration.

Requirements:

- `/` routes to the frontend.
- `/api/` routes to the backend.
- Preserve API paths correctly.
- Forward appropriate proxy headers.
- Handle SPA fallback behavior through the frontend server.
- Avoid exposing internal container details.
- Include appropriate request timeout settings.

Explain the difference between `proxy_pass` configurations with and without a trailing slash.

## Step 4 — Update Compose architecture

Update the production Compose configuration carefully.

Requirements:

- Introduce a reverse proxy service.
- Publish host ports 80 and 443 only for the reverse proxy.
- Remove host port mappings from frontend and API.
- Keep database private.
- Preserve the existing named database volume.
- Preserve restart policies and health checks.
- Keep application images from GHCR.
- Use service-name DNS for internal communication.

Do not run `docker compose down -v`.

Before applying changes, explain which containers will be recreated and why.

## Step 5 — Validate HTTP first

Before configuring HTTPS:

1. Validate Nginx configuration syntax.
2. Start the reverse proxy.
3. Verify frontend routing.
4. Verify API routing.
5. Verify login and blog operations.
6. Verify that direct public access to the frontend/API host ports is no longer possible.

Do not proceed to certificate issuance until DNS and HTTP validation succeed.

## Step 6 — Configure HTTPS

Use Let's Encrypt with an appropriate ACME client.

Explain the ACME challenge process before running it.

Requirements:

- Valid domain resolution.
- Ports 80 and 443 reachable.
- Correct certificate hostname.
- Valid certificate chain.
- HTTP-to-HTTPS redirect.
- Automated renewal.
- Renewal dry-run verification.

Never bypass certificate validation.

Never commit private certificate material or private keys.

## Step 7 — Application verification

Verify:

- Frontend loads through HTTPS.
- API requests use the same HTTPS origin.
- Login works.
- Blog creation and editing work.
- Browser console has no mixed-content errors.
- No frontend asset contains the old localhost API URL.
- CORS configuration is correct.

## Step 8 — Security verification

Check externally reachable ports.

Expected public ports:

- 22 — SSH
- 80 — HTTP redirect and ACME challenge
- 443 — HTTPS

The following must not be publicly reachable:

- 5000 — API
- 8080 — frontend
- 5432 — PostgreSQL

Check both OCI ingress rules and UFW. Remember that Docker-published ports may not be filtered by UFW in the way ordinary host services are.

## Step 9 — Experiments and documentation

Complete the experiments in `MILESTONE-9-SPEC.md`.

Create:

`docs/DNS-REVERSE-PROXY-HTTPS.md`

Document actual configuration, DNS records, certificate renewal, tests, and limitations.

Never include private keys, tokens, passwords, or certificate private material.

## Working rules

- Teach me before executing commands.
- Work one phase at a time.
- Ask for confirmation before disruptive changes.
- Do not risk SSH access.
- Do not delete or recreate the PostgreSQL volume.
- Do not purchase paid services.
- Do not introduce CI/CD deployment or Coolify yet.
- Distinguish verified results from assumptions.
- If a configuration fails, inspect logs and diagnose the actual cause before proposing a fix.

When all acceptance criteria are verified, summarize the milestone and wait for my confirmation before proceeding to Milestone 10.