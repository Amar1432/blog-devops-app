# Milestone 11 — Automated Production Deployment with Coolify

**Project:** `devops-blog`  
**Milestone:** 11  
**Predecessors:** Milestone 9 — DNS, Reverse Proxy, and HTTPS; Milestone 10 — Production Observability, Backup, and Disaster Recovery  
**Workload host:** Existing OCI Ubuntu VM  
**Application domain:** `luffydev.duckdns.org`  
**CI:** GitHub Actions  
**Registry:** GitHub Container Registry (GHCR)  
**CD control plane:** Coolify

## 1. Purpose

Introduce controlled Continuous Delivery for the existing `devops-blog` production application.

Responsibility split:

- **GitHub Actions:** run checks, build application images, tag them, and publish them to GHCR.
- **GHCR:** store versioned application images.
- **Coolify:** receive an authenticated deployment request, pull published images, and orchestrate deployment on the connected workload server.
- **OCI Ubuntu VM:** continue running the production application and existing Nginx edge reverse proxy.
- **Milestone 10 tooling:** provide availability, logging, backup, restore, and rollback verification.

The objective is to remove routine manual SSH/SCP deployment steps without weakening the existing network, TLS, persistence, monitoring, or recovery design.

## 2. Existing production baseline

Use the Milestone 9 and Milestone 10 reports, current repository, and live deployment configuration as the source of truth.

Known baseline from Milestone 9:

- OCI Ubuntu VM hosts the production workload.
- Public application: `https://luffydev.duckdns.org`.
- Existing Nginx reverse proxy owns public TCP ports 80 and 443.
- Nginx forwards `/api/*` to the Express API and other paths to the React SPA.
- Application services run through Docker Compose.
- PostgreSQL 16 uses a named persistent Docker volume.
- Known GHCR image repositories:
  - `ghcr.io/amar1432/devops-blog-api`
  - `ghcr.io/amar1432/devops-blog-web`
- API health endpoint: `/api/health`.
- Milestone 10 introduced availability monitoring, logging, resource inspection, backup/restore, and rollback procedures.

**Mandatory preflight:** verify repository files, workflows, actual image names, image architecture, Compose service names, volumes, network names, server architecture, and production runtime. Do not assume the documented baseline exactly matches the current deployment.

## 3. Primary architecture decision — preserve the existing edge proxy

The workload host already uses Nginx on ports 80 and 443. A default Coolify proxy installation on that same host can conflict with those listeners and disrupt the production site.

### Recommended topology

Use Coolify as a separate control plane (self-hosted on a separate small server, or Coolify Cloud) and connect the existing OCI VM as a remote deployment server.

On the existing OCI workload server:

- Keep current Nginx, DNS, HTTPS, and firewall behavior.
- Configure Coolify's proxy integration for this workload host as **Custom (None)** if Coolify manages its Compose workload. Existing Nginx remains the external proxy and TLS owner.
- Do not start Coolify's Traefik/Caddy proxy on the workload host.
- Do not expose new application or monitoring ports.
- Preserve Nginx-to-container routing.

The separate Coolify control plane has its own dashboard and proxy/network requirements. Secure its dashboard with HTTPS and strong authentication. Restrict SSH access from the Coolify control plane to the workload host as narrowly as practical.

### Alternative topology

Running the Coolify control plane on the existing OCI workload host is possible only after a deliberate port, proxy, resource, and recovery design. Do not treat it as the default installation. If choosing this topology, stop and produce a reviewed port/proxy migration plan before installation.

### Architecture decision gate

Document which topology is selected and why. Do not install Coolify or change firewall/proxy configuration until this decision is approved.

## 4. Goals

By the end of Milestone 11:

1. Coolify is available through a secured dashboard.
2. Coolify can connect to the existing OCI workload host.
3. Coolify can deploy the existing multi-container Compose application without taking ownership of the public edge proxy.
4. Production deployment uses existing GHCR images rather than rebuilding application source on the production host.
5. GitHub Actions runs checks before publishing production images.
6. Images receive immutable commit-specific tags and a controlled production tag.
7. The workload host can authenticate to GHCR and pull required images.
8. Successful image publication triggers exactly one Coolify deployment request.
9. Direct Git push auto-deployment in Coolify is disabled for this workflow to avoid duplicate or premature deployments.
10. Deployment health is checked after rollout.
11. Failed CI does not trigger deployment.
12. A failed deployment can be diagnosed and recovered using Milestone 10 procedures.
13. The workflow records source commit, image tags/digests, deployment result, and smoke-test result.

## 5. Non-goals

- Kubernetes, Helm, or multi-node orchestration.
- Blue/green or canary deployment unless separately designed and approved.
- Automatic database schema rollback.
- Replacing PostgreSQL or changing application architecture.
- Replacing Nginx with Traefik or Caddy.
- Moving the production database to Coolify-managed storage.
- Automatically deploying pull requests to production.
- A complete GitOps platform.
- Automatic OCI firewall changes.
- Unreviewed migration of existing Docker volumes or container ownership.

## 6. Deployment lifecycle

```text
Developer
   |
   v
GitHub Repository (approved production branch)
   |
   v
GitHub Actions
   +--> Checkout exact commit
   +--> Install dependencies
   +--> Lint / typecheck / tests
   +--> Build web image
   +--> Build API image
   +--> Publish commit-specific tags to GHCR
   +--> Publish controlled production tags to GHCR
   +--> Record image metadata/digests
   +--> Trigger authenticated Coolify deploy webhook
                         |
                         v
                    Coolify Queue
                         |
                         v
              Connected OCI Workload Host
                         |
                         v
                 Docker Compose Pull
                         |
                         v
             Reconcile web / API services
                         |
                         v
                 Existing Nginx Proxy
                         |
                         v
             HTTPS public application domain
                         |
                         v
               Post-deployment smoke tests
                         |
                         v
               Uptime Kuma / health checks
```

**Critical ordering:** trigger Coolify only after all required checks pass and all images needed by the production Compose stack have been pushed successfully. Do not trigger Coolify from an independent push event that can race ahead of the build/push jobs.

## 7. Coolify deployment model

Use a model compatible with the existing multi-service Compose application.

Preferred approach:

- Coolify manages the existing Compose application as a deployment resource.
- Compose uses prebuilt `image:` references for web and API, not `build:`.
- Production server pulls images from GHCR.
- PostgreSQL, Nginx, Certbot, Uptime Kuma, persistent volumes, and required networks are retained according to the reviewed design.
- No application service is rebuilt from source on the production host.
- Existing public routing remains with Nginx.

Before importing/adopting the Compose stack, inspect how Coolify parses and normalizes Compose projects. Explicitly preserve existing named Docker volumes and network names. Confirm the generated/deployable Compose definition before the first production deployment.

**Do not create a second production database or second independent Nginx edge stack.** Do not let Coolify create replacement volumes for the existing PostgreSQL data.

If Coolify cannot safely adopt the stack without changing resource names, volume identity, or network routing, stop and propose a staged migration plan. Do not improvise a production cutover.

## 8. Image tagging and release identity

Use two tag classes for each application image:

1. **Immutable commit tag:** `sha-<full-or-short-commit-sha>`.
2. **Controlled production tag:** `production`.

Example references:

```text
ghcr.io/amar1432/devops-blog-web:sha-<commit-sha>
ghcr.io/amar1432/devops-blog-web:production

ghcr.io/amar1432/devops-blog-api:sha-<commit-sha>
ghcr.io/amar1432/devops-blog-api:production
```

Rules:

- Never rely on `latest` as the only production or rollback reference.
- Do not overwrite commit-specific tags.
- Publish the commit-specific image and production tag from the same successful build.
- Record the commit SHA and image digest for each production deployment.
- Ensure Coolify/Compose pulls the updated production tag on each deployment; verify effective pull behavior.
- Retain previous commit-specific images long enough to support rollback.
- Document registry retention and package visibility.
- Verify image architecture matches the OCI VM. Do not hardcode `linux/amd64` or `linux/arm64` until the server architecture is inspected.

The `production` tag is a controlled mutable pointer. The commit-specific tag or digest is the immutable release identity used for audit and rollback.

## 9. GHCR authentication

GitHub Actions should publish images using repository-scoped `GITHUB_TOKEN` with minimum permissions, including `packages: write`.

The Coolify deployment server must authenticate to GHCR if images are private. Use a dedicated token with only required package-read permission, or an approved organization-level registry credential.

- Authenticate the Docker user Coolify actually uses on the deployment server.
- Do not assume a login as a different Linux user makes credentials available to Coolify.
- Verify image pull access before the first production deployment.
- Never put registry tokens in Compose files, Dockerfiles, committed scripts, or logs.
- Document token rotation and revocation.
- If images are public, document and verify that private package access is unnecessary.

## 10. GitHub Actions requirements

Inspect existing workflows before modifying them. Preserve correct tests, build steps, cache configuration, and security checks.

The production workflow must:

- Run on the intended production branch/release event only.
- Use explicit minimal workflow permissions.
- Run required tests/checks before image publication.
- Build both web and API images.
- Publish commit-specific tags and the controlled `production` tag.
- Use platform settings supported by the actual OCI host.
- Publish all required images before triggering Coolify.
- Trigger Coolify exactly once per successful release.
- Use GitHub Actions secrets for webhook URL and API token.
- Avoid printing secrets or embedding them in command output.
- Fail if the Coolify trigger request fails.
- Prevent overlapping production deployments with a concurrency group.
- Avoid triggering production deployments from untrusted pull-request code.
- Record source SHA and published image references/digests as artifacts or job summaries.

Recommended secrets:

- `COOLIFY_WEBHOOK`
- `COOLIFY_TOKEN`

Actual names may follow an existing repository convention.

For GHCR publishing, use `GITHUB_TOKEN` and `packages: write` where possible. Do not create a long-lived GHCR write token unnecessarily.

## 11. Avoid duplicate deployment triggers

Choose exactly one production deployment trigger:

- GitHub Actions builds and publishes images.
- GitHub Actions calls the authenticated Coolify deploy webhook/API.
- Coolify direct source-push auto-deploy is disabled for the production resource unless a separately reviewed architecture explicitly requires it.
- Do not configure both a GitHub repository push webhook and CI deploy webhook to deploy the same production resource.
- Do not configure a second SSH-based deployment script that also restarts the same Compose stack.

This prevents Coolify deploying an old image before GitHub Actions finishes publishing the new one.

## 12. Health checks and post-deployment verification

Review existing service health checks, startup windows, retries, and behavior.

After Coolify reports deployment completion, verify:

- Intended web and API image tags/digests are deployed.
- Web and API containers are running and healthy.
- PostgreSQL is running and its persistent volume is unchanged.
- Nginx is running and its configuration is valid.
- `https://luffydev.duckdns.org/` returns expected success.
- `https://luffydev.duckdns.org/api/health` returns expected success.
- A representative read-only API endpoint works.
- Uptime Kuma reports the expected UP state.
- Browser console/network behavior has no new mixed-content or CORS failures where browser verification is available.

A successful webhook HTTP response is not proof of a successful deployment. Inspect the Coolify deployment record and application health.

## 13. Rollback strategy

Use Milestone 10 rollback and recovery procedures.

1. Identify currently deployed image tags/digests.
2. Identify last known-good commit-specific images for web and API.
3. Confirm the pair belongs to a compatible release.
4. Update production deployment to known-good immutable image references using the reviewed Coolify/Compose procedure.
5. Trigger controlled redeployment.
6. Verify web, API, database connectivity, Nginx routing, and Uptime Kuma.
7. Record rollback event and root cause.

Database migrations require special care. Application rollback is not automatically database rollback. If a release includes a non-backward-compatible schema migration, stop and follow a separately reviewed database recovery plan.

Do not delete images required for rollback.

## 14. Security requirements

- Coolify dashboard uses HTTPS and strong authentication.
- Restrict dashboard access where practical.
- Restrict SSH from Coolify control plane to workload server to known source addresses where practical.
- Use a dedicated SSH identity with minimum practical privileges required by Coolify's Docker deployment model.
- Do not disable SSH host-key verification.
- Keep GHCR and Coolify tokens in GitHub Secrets or an approved secret manager.
- Use least-privilege GitHub Actions permissions.
- Never expose PostgreSQL, API, web, or Uptime Kuma management ports publicly.
- Preserve OCI security list and UFW rules unless an explicitly reviewed change is necessary.
- Do not expose direct Coolify dashboard ports publicly after a secure domain/proxy path is configured unless the chosen topology requires and secures them.
- Redact credentials, tokens, webhook URLs, and private host information from evidence.
- Pin third-party GitHub Actions to reviewed versions or immutable commit SHAs according to repository policy.

## 15. Repository deliverables

Inspect the repository and follow existing conventions. Suggested organization:

```text
devops-blog/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-production.yml
├── compose.yaml
├── .env.example
└── docs/
    └── operations/
        ├── MILESTONE-11.md
        ├── COOLIFY-ARCHITECTURE.md
        ├── CI-CD-PIPELINE.md
        ├── DEPLOYMENT-RUNBOOK.md
        └── ROLLBACK.md
```

Do not create duplicate workflows or docs if equivalent files already exist.

## 16. Required experiments

1. Deploy current known-good release through Coolify manually as a baseline.
2. Merge a harmless application change and verify CI → GHCR → Coolify.
3. Introduce a test failure and verify no production image deployment is triggered.
4. Verify a deployment request occurs only after both application images are published.
5. Verify only one deployment occurs for one successful release.
6. Verify deployed commit and image digest match the workflow release.
7. Simulate a failed deployment in a controlled environment or safe non-destructive scenario.
8. Roll back to a previous commit-specific image.
9. Verify application and Uptime Kuma after rollback.
10. Verify PostgreSQL data and volume identity remain unchanged.

Production experiments must be reviewed and scheduled. Prefer staging or an isolated resource for deliberately broken image tests.

## 17. Definition of Done

- [ ] Architecture decision documented and approved.
- [ ] Existing Nginx ownership of ports 80/443 preserved.
- [ ] Coolify control plane secured.
- [ ] Coolify can connect to OCI workload host.
- [ ] Coolify workload-host proxy does not conflict with Nginx.
- [ ] GHCR authentication works for the deployment user.
- [ ] Existing Compose service, volume, and network identities preserved.
- [ ] Production Compose uses prebuilt web and API images.
- [ ] Commit-specific immutable image tags are published.
- [ ] Controlled production tag is published.
- [ ] CI checks pass before image publication.
- [ ] Coolify deploy is triggered only after all required images are published.
- [ ] Duplicate source-push deployment triggers are disabled.
- [ ] Deployment concurrency is controlled.
- [ ] Coolify logs show the intended release.
- [ ] Post-deployment smoke tests pass.
- [ ] Uptime Kuma reports expected application status.
- [ ] Failed CI does not deploy.
- [ ] Rollback to known-good image has been tested.
- [ ] PostgreSQL data and persistent volume remain intact.
- [ ] Documentation includes architecture, workflow, secrets, runbook, rollback, evidence, and limitations.
- [ ] No secrets are committed or exposed.
- [ ] Milestone 9 and 10 behavior remains healthy.

## 18. Suggested implementation order

1. 11.1 — Repository audit and architecture decision.
2. 11.2 — Coolify control plane and remote server connection.
3. 11.3 — GHCR authentication and image release strategy.
4. 11.4 — Coolify adoption of existing Compose workload.
5. 11.5 — GitHub Actions CI → image publication → Coolify deployment.
6. 11.6 — Health verification, failure handling, and rollback.
7. 11.7 — End-to-end experiments and final documentation.

Each phase stops at a review gate. Do not perform a production cutover until resource adoption, proxy, volume, and rollback plans have been explicitly reviewed.

**Milestone principle:** CI proves that a release is ready to deploy. CD deploys that exact release in a controlled and observable way. A production deployment is complete only after the running application has been verified.
