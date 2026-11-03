# Coolify Architecture Decision (Milestone 11.1)

**Status:** Approved — Option A accepted by operator (2026-11-03)
**Scope of this phase:** Repository audit and architecture decision only
**Production changes made in this phase:** None
**Secrets included in this document:** None

This document records the existing production baseline, the recommended Coolify topology, the rejected alternative, and the exact facts that still require live confirmation before any installation or cutover.

---

## Approval Record and 11.2 Addendum

**Decision approved:** Option A — separate Coolify control plane, OCI workload host as a remote deployment server, workload proxy mode **Custom (None)**.

**Control-plane implementation:** The operator may use either:

- **A1 — Self-hosted Coolify** on a dedicated local headless VM via Canonical Multipass on macOS (Ubuntu 24.04 LTS, 2 CPUs, 3 GB RAM, 20 GB disk; selected by operator) or a separate cloud host, or
- **A2 — Coolify Cloud** (Coolify-managed control plane).

Both preserve the architecture. The implemented choice is recorded in `docs/operations/COOLIFY-SETUP-RUNBOOK.md`.

**New safety finding from current official Coolify documentation (11.2):**

1. Adding and validating a remote server makes Coolify **start the selected proxy on that server**. Traefik is the default. On the workload host this would attempt to bind 80/443 and conflict with Nginx.
   - **Mitigation:** create the server record and set **Proxy = Custom (None)** *before* validating the connection. Verify the proxy type is `none` and that no `coolify-proxy` container runs on the workload host.
2. Validation "installs or verifies Docker Engine and Docker Compose" and **can restart the Docker service**, which may briefly make existing containers unavailable.
   - **Mitigation:** treat remote-server validation as a maintenance-window operation: take a fresh Milestone 10 PostgreSQL backup first, keep an SSH session open, and verify all production services after validation.

These findings do not change the architecture; they change the order of operations. The exact sequence is in `docs/operations/COOLIFY-SETUP-RUNBOOK.md`.

**Outage behavior (unchanged):** if the control plane is down, the workload Compose stack continues serving traffic under `restart: unless-stopped`. Only new deployments are blocked.

---

## 1. Phase Objective

Determine the safest way to introduce Coolify without disrupting:

- the existing Nginx edge reverse proxy on TCP 80/443,
- the existing Let's Encrypt TLS and ACME renewal flow,
- the existing production Docker Compose stack,
- or the persistent PostgreSQL volume.

No installation, firewall change, DNS change, Compose change, or deployment is performed in 11.1.

---

## 2. Evidence Sources Inspected

| Source | What it established |
| :--- | :--- |
| `git status`, `git remote -v`, `git log` | Branch is `main`; remote is `https://github.com/Amar1432/blog-devops-app.git`; Milestone 10 is the current head. |
| `.github/workflows/ci.yml` | Single workflow with jobs `backend`, `frontend`, `docker`, `publish`. No deploy job exists. |
| `deploy/compose.yaml` | Production stack: `db`, `api`, `web`, `proxy`, `certbot`, `uptime-kuma`. Explicit network and volume names. |
| `deploy/nginx/default.conf` | Nginx listens on 80/443, terminates TLS, routes `/api/` to `api:5000`, everything else to `web:80`. |
| `deploy/.env.example` | Production variable contract, including optional `API_IMAGE` / `WEB_IMAGE` overrides. |
| `apps/api/Dockerfile`, `apps/web/Dockerfile` | Root-context monorepo builds; no server-side compilation required at deploy time. |
| `docs/DNS-REVERSE-PROXY-HTTPS.md` | Milestone 9 baseline: Nginx owns 80/443, TLS via Certbot, firewall state. |
| `docs/MANUAL-DEPLOYMENT.md` | Documented host specification, image digests, Compose layout, and deployment directory `/opt/devops-blog`. |
| `docs/operations/MILESTONE-10.md` | Uptime Kuma, bounded logging, backups, restore, rollback. |
| `docs/operations/ROLLBACK.md` | Existing immutable-tag rollback procedure. |
| `docs/GHCR-IMAGE-PUBLISHING.md` | Image names, current tag policy, and documented package visibility. |

`docker compose -f deploy/compose.yaml config --quiet` cannot run locally without a populated env file (Compose correctly fails on the required `${POSTGRES_USER}` interpolation). This is expected locally and is not a production issue.

---

## 3. Existing-State Findings

### 3.1 Repository and production source of truth

- The repository remote is `Amar1432/blog-devops-app`; GHCR paths are lowercased to `amar1432`.
- The production deployment directory is documented as `/opt/devops-blog/`, containing `compose.yaml`, `.env`, and `nginx/default.conf`.
- The production Compose project name is `devops-blog-prod`.
- Milestone 10 added `uptime-kuma` to the same production Compose stack.

### 3.2 Current CI responsibilities

`.github/workflows/ci.yml` currently performs:

1. `backend` — Prisma client generation, lint, migrations against a PostgreSQL service container, Jest tests.
2. `frontend` — lint, Vitest, Vite production build.
3. `docker` — Buildx validation of both images with `push: false` on `linux/amd64`.
4. `publish` — on `push` to `main` only, logs in to GHCR with `GITHUB_TOKEN`, builds and pushes both images.

Current permissions are already least-privilege at the workflow root (`contents: read`) and scoped (`packages: write`) only on `publish`. Pull requests cannot reach `publish` because of the `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` guard.

Concurrency is `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress` disabled for `main`. There is **no deployment job** today.

### 3.3 GHCR image repositories and current tag strategy

| Image | Repository | Current tags produced by CI | Platform |
| :--- | :--- | :--- | :--- |
| API | `ghcr.io/amar1432/devops-blog-api` | `sha-<short-sha>`, `latest` | `linux/amd64` |
| Web | `ghcr.io/amar1432/devops-blog-web` | `sha-<short-sha>`, `latest` | `linux/amd64` |

The `sha-*` tag uses `type=sha,prefix=sha-,format=short` (short SHA). The spec permits `sha-<full-or-short-commit-sha>`, so the short form is acceptable, but it must be documented as such.

`latest` is mutable. The spec requires a controlled `production` tag in addition to an immutable commit tag. **That `production` tag does not exist yet; it is a deliverable for 11.3/11.5, not 11.1.**

### 3.4 Production Compose identities that must be preserved

| Resource | Compose key | Explicit runtime name |
| :--- | :--- | :--- |
| Project | `name: devops-blog-prod` | `devops-blog-prod` |
| Network | `backend-network` | `devops-blog-prod-network` |
| PostgreSQL volume | `devops-blog-postgres-data` | `devops-blog-prod-postgres-data` |
| Certbot cert volume | `certbot-etc` | `devops-blog-prod-certbot-etc` |
| Certbot webroot volume | `certbot-www` | `devops-blog-prod-certbot-www` |
| Uptime Kuma volume | `uptime-kuma-data` | `devops-blog-prod-uptime-kuma-data` |

Services and their roles:

| Service | Image / source | Host ports | Notes |
| :--- | :--- | :--- | :--- |
| `db` | `postgres:16-alpine` | None | Named volume at `/var/lib/postgresql/data`; healthcheck `pg_isready`. |
| `api` | `${API_IMAGE:-ghcr.io/amar1432/devops-blog-api:latest}` | None | Healthcheck uses Node `fetch` against `/api/health`. |
| `web` | `${WEB_IMAGE:-ghcr.io/amar1432/devops-blog-web:latest}` | None | Runtime `sed` rewrites baked API URL; healthcheck via `wget`. |
| `proxy` | `nginx:1.27-alpine` | `80:80`, `443:443` | Mounts `./nginx/default.conf` read-only plus cert volumes. |
| `certbot` | `certbot/certbot:latest` | None | `restart: "no"`; invoked by cron for renewals. |
| `uptime-kuma` | `louislam/uptime-kuma:1.23.16` | `127.0.0.1:3001:3001` | Loopback-only monitoring dashboard. |

### 3.5 Port and edge ownership

- `proxy` publishes `80:80` and `443:443`; this is the only public application entry point.
- `uptime-kuma` is bound to `127.0.0.1:3001` and must not be exposed publicly.
- `db`, `api`, and `web` publish **no host ports**.
- Milestone 9 documentation records UFW and OCI Security List rules limited to TCP 22, 80, and 443.

**Conclusion: Nginx owns the public edge. Coolify must not allocate ports 80/443 on this workload host.**

### 3.6 Nginx upstream and DNS assumptions

`deploy/nginx/default.conf` contains:

- `proxy_pass http://api:5000;` (no trailing slash, so the `/api/...` path is preserved).
- `proxy_pass http://web:80;`.
- `server_name luffydev.duckdns.org;`.
- Certificate paths under `/etc/letsencrypt/live/luffydev.duckdns.org/`.
- ACME webroot `/var/www/certbot`.

These are **Compose service-name DNS lookups**, not hard-coded container names. They resolve through Docker embedded DNS on `devops-blog-prod-network`. Any tool that renames services or moves them to a different network will break Nginx routing.

Additional path assumptions to protect:

- The `proxy` bind mount is relative: `./nginx/default.conf`. The directory used by the deployer must contain `nginx/default.conf`, or the mount must be converted to a stable absolute path.
- The documented renewal cron runs from `/opt/devops-blog` using `docker compose ...`. If the project directory or project name changes, renewal can silently target the wrong stack.

### 3.7 Target architecture evidence

Documented in `docs/MANUAL-DEPLOYMENT.md`:

- Ubuntu 26.04.1 LTS, Oracle kernel `7.0.0-1013-oracle`, `x86_64`.
- AMD EPYC 7551, 2 vCPUs.
- ~951 MiB RAM, 2 GiB swap.
- 45 GB NVMe.
- Docker Engine 29.x, Compose v5.x (documented values may drift; confirm live).

CI currently builds `linux/amd64`, which is consistent with the documented `x86_64` host. This is strong documentary evidence, not a live confirmation. Live confirmation commands are listed in Section 8.

### 3.8 Milestone 10 dependencies

The production stack now includes Uptime Kuma in the same Compose project, with its own named volume. Any Coolify adoption must not:

- recreate the `devops-blog-prod-uptime-kuma-data` volume,
- restart Uptime Kuma unnecessarily during routine app releases,
- break the loopback-only dashboard binding.

Backups are written to `/opt/devops-blog/backups` and are not part of the Compose stack.

---

## 4. Documentation vs. Repository Mismatches

| # | Mismatch | Impact | Handling |
| :--- | :--- | :--- | :--- |
| 1 | `docs/MANUAL-DEPLOYMENT.md` still shows the pre-Milestone-9 architecture (public ports 8080/5000). | Historical drift only; Milestone 9 superseded it. | Do not use it as the current edge design. Refer to `DNS-REVERSE-PROXY-HTTPS.md`. Optionally annotate as historical in a later docs pass. |
| 2 | Spec says "Known GHCR repositories from Milestone 9"; image publishing actually began in Milestone 6 and was exercised in Milestone 8/9. | None; names still correct. | Recorded for accuracy. |
| 3 | CI publishes `sha-<short>` and `latest`, but the spec requires a controlled `production` tag. | A Coolify/Compose deployment cannot yet reference `:production`. | Implement in 11.3/11.5. Do not deploy using `latest`. |
| 4 | `deploy/compose.yaml` defaults `API_IMAGE` and `WEB_IMAGE` to `:latest`. | Silent use of a mutable tag if overrides are absent. | Change default to `:production` with SHA override support in 11.4, after review. |
| 5 | `docs/MANUAL-DEPLOYMENT.md` states both GHCR packages are public. | Determines whether the workload host needs registry credentials. | Confirm live in 11.3 before assuming anonymous pulls work. |
| 6 | `docs/MANUAL-DEPLOYMENT.md` says Milestone 10 would add automated deployment; Milestone 10 actually covered observability/backup/DR. | Historical drift only. | Recorded; no action. |
| 7 | The web image is built without a `VITE_API_URL` build arg, so it bakes `http://localhost:5000/api`; production relies on a runtime `sed` replacement to `/api`. | Fragile string dependency; a source change to the fallback string would silently break the rewrite. | Preserve the runtime `sed` contract in 11.4; consider a build-arg in a later release. |

---

## 5. Architecture Decision (ADR-11-01)

### Decision

Adopt **Option A: a separate Coolify control plane connected to the existing OCI Ubuntu workload host as a remote deployment server.**

On the workload host:

- Keep the existing Nginx container as the only public edge proxy and TLS owner.
- Set the Coolify proxy mode for this server to **Custom (None)**.
- Do not install or start Coolify's Traefik or Caddy on the workload host.
- Do not expose any new application or monitoring ports.

### Rationale

1. **Port safety.** The workload host already binds 80/443 with Nginx. A separate control plane cannot conflict with those listeners.
2. **Resource safety.** The workload host has ~951 MiB RAM. A Coolify control plane plus its own database/cache would compete with PostgreSQL, the API, web, Nginx, Certbot, and Uptime Kuma. Even with 2 GiB swap, this risks OOM-killer behavior during image pulls and container recreation.
3. **Failure isolation.** A control-plane outage must not stop the running application. With Option A, the workload stack keeps running independently under `restart: unless-stopped` even if Coolify is down.
4. **Recovery simplicity.** The workload host remains a plain Docker Compose host. Milestone 10 backup, restore, and rollback procedures continue to work without Coolify in the critical path.
5. **Least change to a working production design.** Milestone 9 TLS/ACME and Milestone 10 monitoring stay exactly as they are.

### Rejected alternative

**Option B: Coolify control plane on the existing OCI workload host with its managed proxy disabled.**

Rejected because:

- It still adds control-plane processes, a database, and cache to a 1 GB RAM host.
- Default installation behavior can start a managed proxy and bind 80/443, which would conflict with Nginx.
- It increases blast radius: a control-plane upgrade or crash could affect the same host running production.
- It would require a separately reviewed port, proxy, resource, and recovery migration plan before installation. The spec explicitly forbids treating this as the default.

Option B remains a fallback only if Option A is proven impractical, and only after a reviewed migration plan.

### Trade-off comparison

| Dimension | Option A: separate control plane | Option B: same workload host |
| :--- | :--- | :--- |
| Cost | One additional small control-plane host (may fit OCI free tier or Coolify Cloud). | No new host, but higher resource pressure on the existing free-tier VM. |
| Security | SSH surface can be restricted to the control-plane egress IP; dashboard isolated from the workload host. | Dashboard and production share one host; a dashboard compromise is a production compromise. |
| Network | Control plane -> SSH -> workload Docker; workload pulls from GHCR. No new public app ports. | Same host; still needs careful port/proxy isolation. |
| Recovery | Workload stack survives control-plane outage. | Control-plane failure can affect production. |
| Port conflict | None; Nginx keeps 80/443. | High risk unless Coolify proxy is fully disabled and verified. |
| Operational complexity | One more host to patch and back up. | Fewer hosts but a more fragile single node. |

### Network flow (Option A)

```text
Developer
   |
   v
GitHub (main)
   |
   v
GitHub Actions (backend, frontend, docker, publish)
   |
   v
GHCR (devops-blog-api, devops-blog-web)
   |
   |  authenticated deploy webhook/API (HTTPS)
   v
Coolify control plane (separate host)
   |
   |  SSH (22), restricted source, host-key verified
   v
OCI workload host :22
   |
   v
Docker Engine -> docker compose reconcile
   |
   +--> pull images from GHCR
   |
   v
Existing Nginx :80/:443  (unchanged public edge)
   |
   +--> /api/  -> api:5000
   +--> /      -> web:80
                     |
                     v
                 db:5432 (internal only)

Public user -> https://luffydev.duckdns.org -> OCI Nginx
```

The Coolify dashboard is reachable only over its own secured HTTPS endpoint on the control plane. It is not part of the application request path.

### SSH access design

- Create a dedicated SSH identity for Coolify. The private key stays outside the repository and outside committed files.
- Add only the public key to the workload host account that Coolify will use.
- Coolify needs Docker access. On this host that means `root` or a user in the `docker` group, which is effectively root-equivalent. Treat this identity as highly privileged and scope its use narrowly.
- Restrict inbound TCP 22 to the control plane's egress IP where practical. If the control-plane IP is not stable, document the residual risk and prefer a bastion or VPN over opening 22 broadly.
- Keep SSH host-key verification enabled. Never disable it.
- Do not remove the operator's existing SSH access while adding Coolify's key.

### Registry access design (summary; detailed in 11.3)

- If GHCR packages remain public, anonymous pulls may work; confirm live before relying on it.
- If private, use a dedicated read-only package token (`read:packages`) and authenticate as the Linux user Coolify actually uses. A login as a different user does not help Coolify.
- Document rotation and revocation. Never commit tokens or place them in Compose files, Dockerfiles, scripts, or logs.

### Coolify proxy setting on the workload host

- **Custom (None).**
- Coolify must not start Traefik or Caddy on the workload host.
- Coolify must not publish 80/443 on the workload host.
- Existing Nginx remains the only public listener.

### Compose adoption strategy (high-level; executed in 11.4)

The existing production Compose is already close to the target model because it uses prebuilt images, not `build:`.

11.4 will:

1. Preserve the explicit `name:` values for the network and all four volumes.
2. Preserve service names `db`, `api`, `web`, `proxy`, `certbot`, `uptime-kuma`.
3. Change image defaults from `:latest` to `:production` while keeping SHA/digest overrides.
4. Make the `./nginx/default.conf` bind mount robust to Coolify's working directory.
5. Review Coolify's generated/deployable Compose output before any cutover.
6. Verify PostgreSQL and Uptime Kuma volumes are reused, not recreated.
7. Keep `proxy` on 80/443 and keep all other services internal.
8. Define pull behavior for the mutable `production` tag (e.g. `pull_policy: always` if supported and confirmed) instead of assuming a webhook refresh forces a new pull.
9. Confirm the Certbot renewal cron still targets the right project directory and project name.

No production deployment occurs until that configuration is reviewed.

---

## 6. Risks and Assumptions

| # | Risk / assumption | Severity | Mitigation |
| :--- | :--- | :--- | :--- |
| 1 | Coolify normalizes project/service/volume/network names and breaks Docker DNS (`api`, `web`) or volume identity. | Critical | Explicit `name:` values; review generated Compose; test on a non-production clone first. |
| 2 | Coolify or its proxy binds 80/443 on the workload host. | Critical | Proxy mode Custom (None); verify with `ss -tlnp` after setup. |
| 3 | PostgreSQL volume is recreated or replaced. | Critical | Explicit volume name; verify `docker volume ls` and data before/after; backup via Milestone 10 first. |
| 4 | Private GHCR packages fail to pull because the wrong Linux user is authenticated. | High | Confirm visibility; test `docker pull` as the Coolify user before cutover. |
| 5 | `:production` tag does not exist yet; deployer falls back to `:latest`. | High | Do not deploy before 11.3/11.5 add `production`; change defaults in 11.4. |
| 6 | `./nginx/default.conf` relative bind mount resolves to a different directory under Coolify. | High | Use a stable path or convert to an absolute path after reviewing Coolify's deployment directory. |
| 7 | Certbot cron continues to run against `/opt/devops-blog` while Coolify deploys from another directory. | High | Keep the project directory stable or update the cron to an explicit `-f` path during 11.4. |
| 8 | Uptime Kuma restarts on every app release. | Medium | Reconcile only `api` and `web` where possible; otherwise accept and verify monitoring recovery. |
| 9 | Control-plane host is not yet provisioned. | Blocker for 11.2 | Operator provisions it; Option A assumes this is feasible. |
| 10 | Documented host architecture (`x86_64`) differs from live host. | High | Confirm with `uname -m` and `docker info` before 11.3. |
| 11 | SSH hardening accidentally locks out the operator. | High | Keep an active session; add Coolify key before restricting source; test in a second session. |
| 12 | Duplicate deployment triggers (Coolify Git auto-deploy plus Actions webhook). | High | Disable Coolify direct Git auto-deploy; use exactly one trigger. |
| 13 | Server validation starts Coolify's default Traefik proxy on the workload host and conflicts with Nginx on 80/443. | Critical | Create the server record, set Proxy = Custom (None), and confirm `proxy_type=none` before validation; verify no `coolify-proxy` container. |
| 14 | Server validation restarts Docker and briefly interrupts production containers. | High | Schedule a maintenance window, take a fresh Milestone 10 backup, keep an SSH session open, and run the full smoke test immediately after validation. |

---

## 7. Preflight Checklist

Complete before starting 11.2 or any production change:

- [ ] This architecture decision (Option A) is reviewed and approved.
- [ ] A control-plane host (or Coolify Cloud) is selected and its OS/resources confirmed.
- [ ] Coolify dashboard will be served over HTTPS with strong authentication.
- [ ] A dedicated SSH identity for Coolify is planned; the private key stays out of the repository.
- [ ] The workload host keeps its existing operator SSH access.
- [ ] Inbound SSH source restriction is planned where practical.
- [ ] SSH host-key verification remains enabled.
- [ ] OCI Security List and UFW remain limited to TCP 22, 80, 443 (no new public app/monitoring ports).
- [ ] Workload host architecture is confirmed (`x86_64` expected).
- [ ] Docker Engine and Compose versions are recorded.
- [ ] GHCR package visibility is confirmed; a read-only token is prepared only if needed.
- [ ] A fresh Milestone 10 PostgreSQL backup exists before any cutover.
- [ ] Milestone 10 rollback procedure is reviewed.
- [ ] A maintenance window is agreed for the eventual 11.4 cutover.
- [ ] Coolify proxy mode on the workload host is confirmed as Custom (None).
- [ ] The production Compose generated by Coolify is reviewed before deployment.
- [ ] Coolify direct Git auto-deploy is disabled; one deployment trigger only.

---

## 8. Exact Production Facts Still Needing Confirmation

These are read-only checks. Run them on the workload host unless noted. Do not paste secrets into tickets, chat, or this document.

### Host and runtime

```bash
uname -m
docker info --format '{{.Architecture}}'
docker version --format '{{.Server.Version}}'
docker compose version
nproc
free -m
df -h /
```

Expected from documentation: `x86_64`, `amd64`, ~2 vCPU, ~951 MiB RAM, 2 GiB swap, ~40 GB free. Confirm actual values.

### Docker identities and current state

```bash
docker volume ls | grep devops-blog
docker network ls | grep devops-blog
ls -la /opt/devops-blog
ls -la /opt/devops-blog/nginx
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps
```

Confirm:

- volume `devops-blog-prod-postgres-data` exists,
- network `devops-blog-prod-network` exists,
- `nginx/default.conf` is present next to the production Compose file,
- all services are running and healthy.

### Edge port ownership

```bash
sudo ss -tlnp | grep -E ':(80|443)\b'
```

Confirm that host ports 80 and 443 are held only by the Docker proxy/Nginx container.

### Firewall

```bash
sudo ufw status verbose
```

Confirm only 22, 80, and 443 are allowed inbound.

### Certbot renewal

```bash
sudo crontab -l 2>/dev/null
sudo ls -la /etc/cron.d
```

Confirm the renewal job path and that it targets `/opt/devops-blog` (or record the actual path).

### Current deployed images and digests

```bash
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps -q api
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps -q web
```

Then, for each container ID:

```bash
docker inspect <container-id> --format '{{.Config.Image}}'
docker image inspect <container-id> --format '{{json .RepoDigests}}'
```

Also confirm whether `/opt/devops-blog/.env` currently overrides `API_IMAGE` and `WEB_IMAGE` (values may be recorded without secrets):

```bash
grep -E '^(API_IMAGE|WEB_IMAGE)=' /opt/devops-blog/.env || echo "no image overrides set"
```

### GHCR visibility and pull access

From the workload host, as the user Coolify will use:

```bash
docker pull ghcr.io/amar1432/devops-blog-api:latest
docker pull ghcr.io/amar1432/devops-blog-web:latest
```

Record success or failure. If it fails, the packages are private and 11.3 must configure registry authentication.

### Uptime Kuma

```bash
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps uptime-kuma
```

Confirm the container is healthy and the dashboard remains loopback-bound (`127.0.0.1:3001`).

### Control plane (once provisioned)

```bash
uname -a
free -m
df -h /
docker --version
```

Record OS, resources, and Docker availability before 11.2.

---

## 9. Validation Performed in 11.1

- Repository tree, Git status, remote, branch, and recent commits inspected.
- Compose files, environment examples, Dockerfiles, Nginx configuration, and the CI workflow read in full.
- Milestone 9 and Milestone 10 operational documentation reviewed.
- Confirmed from repository evidence that Nginx is the only service publishing host ports 80/443 in the production Compose file.
- Confirmed explicit network and volume names in `deploy/compose.yaml`.
- Confirmed Nginx routes via Compose service names (`api`, `web`), not container names.
- Confirmed no deploy job exists in the current CI workflow.
- Confirmed no secrets or real credentials are written to this document.
- No production access, installation, firewall, DNS, or Compose change was performed.

Not validated in 11.1 (requires production access or operator action):

- live host architecture,
- live volume/network inventory,
- live GHCR pull access as the Coolify user,
- live firewall and port ownership,
- control-plane availability.

---

## 10. Acceptance Criteria for 11.1

- [x] Architecture decision documented with rationale and rejected alternative.
- [x] Existing Nginx ownership of 80/443 identified and preserved in the design.
- [x] Existing Compose service, volume, and network identities recorded.
- [x] Nginx upstream/DNS assumptions recorded.
- [x] Documented vs. repository mismatches reported.
- [x] Preflight checklist provided.
- [x] Exact remaining production facts and read-only verification commands listed.
- [x] No production changes.
- [x] No secrets included.
- [x] Operator approves the architecture decision. **(approved 2026-11-03)**

---

## 11. Rollback Considerations

This phase made no infrastructure or runtime change, so there is nothing to roll back. If the decision is rejected, revise this document and re-present the topology before any 11.2 installation.

---

## 12. Next Phase

**11.2 — Coolify control plane and remote workload server (operator-guided).**

Option A is approved. The operator steps, safety ordering, and verification checklist are in `docs/operations/COOLIFY-SETUP-RUNBOOK.md`. This phase does not install or configure anything from the coding-agent side; the operator executes the runbook and records evidence.
