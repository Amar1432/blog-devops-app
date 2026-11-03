# Coolify Setup Runbook (Milestone 11.2)

**Status:** Operator-guided procedure — not executed by the coding agent
**Parent decision:** `docs/operations/COOLIFY-ARCHITECTURE.md` (Option A approved)
**Production changes performed by the agent in this phase:** None
**Secrets in this document:** None (placeholders only)

This runbook prepares a Coolify control plane and connects the existing OCI Ubuntu workload host as a remote deployment server, while Nginx remains the only public edge on ports 80 and 443.

---

## 0. Scope and Safety Contract

This phase is executed by the operator. The coding agent must not:

- run the Coolify installer,
- connect to production,
- change OCI Security Lists, UFW, DNS, or SSH configuration,
- start Coolify's proxy on the workload host,
- stop, recreate, or migrate production containers.

The operator must:

- keep an active SSH session open while changing SSH or firewall rules,
- take a fresh PostgreSQL backup before validating the remote server,
- verify in a second terminal before closing the first session,
- record evidence in Section 13.

### Placeholders

| Placeholder | Meaning |
| :--- | :--- |
| `<CONTROL_PLANE_IP>` | Public IP of the Coolify control-plane host |
| `<WORKLOAD_HOST>` | OCI workload host IP or hostname (`129.154.253.114` in current docs) |
| `<COOLIFY_DASHBOARD_DOMAIN>` | Dedicated dashboard hostname, e.g. `coolify.example.com` |
| `<SSH_USER>` | SSH user Coolify will use on the workload host |
| `<SSH_PORT>` | SSH port, normally `22` |
| `<COOLIFY_CP_EGRESS_IP>` | Public egress IP of the control plane (self-hosted), or Cloud ranges |

Do not reuse `luffydev.duckdns.org` for the dashboard. Use a distinct hostname.

### Required decisions before starting

1. **Control plane:** A1 self-hosted on a separate host, or A2 Coolify Cloud.
2. **Dashboard hostname + DNS:** a hostname that points to the control plane.
3. **SSH identity on the workload host:** root with key-only login (official path), or a non-root user with passwordless sudo (experimental), or the existing `devopsadmin`.

Record the decisions in Section 13.

---

## 1. Pre-Install Checklist

Control plane (A1 only):

- [ ] Fresh Linux host with SSH access and root/sudo.
- [ ] Supported OS (Ubuntu LTS or Debian preferred).
- [ ] At least 2 CPU cores, 2 GB RAM, 10 GB free disk (official minimum).
- [ ] `amd64` or `arm64` architecture.
- [ ] No existing web server binding 80/443 (Coolify's proxy will own them on the control plane).
- [ ] Inbound TCP 22, 80, 443; TCP 8000/6001/6002 temporarily for first access.
- [ ] Dashboard DNS hostname ready to point at `<CONTROL_PLANE_IP>`.

Workload host:

- [ ] Current SSH access retained and tested.
- [ ] Docker Engine and Compose present and healthy.
- [ ] Nginx container holds 80/443 (`sudo ss -tlnp` confirms).
- [ ] Milestone 10 backup just taken successfully.
- [ ] Maintenance window agreed (validation can restart Docker briefly).
- [ ] OCI Security List and UFW currently allow only 22, 80, 443.
- [ ] No new ports will be opened.

---

## 2. Install the Control Plane

### A1 — Self-hosted Coolify (Local Multipass Ubuntu VM or Separate Cloud Host)

For this setup, the control plane is hosted locally on macOS using a headless **Canonical Multipass** Ubuntu 24.04 LTS VM.

#### Step 1: Launch the Local VM on macOS

Run on your Mac terminal:

```sh
# 1. Install Multipass (if not already installed)
brew install --cask multipass

# 2. Launch headless Ubuntu 24.04 LTS VM (2 CPUs, 3 GB RAM, 20 GB Disk)
multipass launch 24.04 --name coolify-cp --cpus 2 --memory 3G --disk 20G

# 3. Retrieve the VM's local IP address
multipass info coolify-cp
```

Take note of the IPv4 address assigned to `coolify-cp` (for example, `192.168.64.x`). This is your `<CONTROL_PLANE_IP>`.

#### Step 2: Install Coolify inside the VM

```sh
# Enter the VM shell
multipass shell coolify-cp

# Inside the VM, run the official Coolify installer
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Notes from the official documentation:
- The installer installs Docker, sets up Coolify under `/data/coolify`, and starts the dashboard containers.
- The installation takes approximately 2–3 minutes to complete.

#### Step 3: Initial Dashboard Access

1. Open your Mac browser and navigate to `http://<VM_IP>:8000` (e.g., `http://192.168.64.x:8000`).
2. **Immediately create the admin account.** The first visitor becomes instance admin.
3. Back up `/data/coolify/source/.env` to a safe offline location. It contains the installation `APP_KEY`; without it, restoring Coolify is not possible:
   ```sh
   # Inside the multipass VM:
   sudo cat /data/coolify/source/.env
   ```
4. Enable strong authentication and, if available, passkeys after HTTPS is configured.

### A2 — Coolify Cloud

If using Coolify Cloud:

- Sign in at the Coolify Cloud dashboard.
- The Coolify team manages the control plane and its dashboard security.
- You still connect the workload host as a remote server and still set its proxy to Custom (None).
- Allow Coolify Cloud source addresses for inbound SSH on the workload host. Use the published lists, which can change:
  - <https://coolify.io/ipv4.txt>
  - <https://coolify.io/ipv6.txt>

Do not hardcode old Cloud IP ranges.

---

## 3. Secure the Dashboard with HTTPS

Do this on the control plane before connecting production.

1. Create a DNS `A` record for `<COOLIFY_DASHBOARD_DOMAIN>` pointing to `<CONTROL_PLANE_IP>`. Do not point it at the workload host.
2. Wait for DNS resolution to match.
3. In Coolify: **Settings > General > URL**.
4. Enter `https://<COOLIFY_DASHBOARD_DOMAIN>` (must start with `https://`).
5. Select **Save changes**.
6. Verify:
   - `curl -I https://<COOLIFY_DASHBOARD_DOMAIN>` returns a valid TLS response.
   - Login works over the domain.
   - Live updates appear during a test action.
   - The web terminal opens.

Only after the dashboard works over HTTPS should you close direct access:

- Close inbound TCP `8000`, `6001`, and `6002` in the host firewall/provider firewall, **or**
- Bind them to localhost with a Compose override as documented at <https://coolify.io/docs/core/infrastructure/servers/firewall>.

Keep an SSH session open. Do not close the direct ports before the HTTPS path is proven.

---

## 4. Create the Dedicated SSH Identity for Coolify

Coolify needs a private key whose public key is authorized on the workload host.

### 4.1 Create the key in Coolify

1. Open **Keys & Tokens > Private Keys**.
2. Select **New private key** / **+ Add**.
3. Choose **Generate ED25519**.
4. Name it, for example, `oci-workload-deploy`.
5. Save, then edit it and copy the complete **Public key**.

Do not add a passphrase. Coolify cannot answer an interactive prompt.

Do not paste the private key into the repository, a ticket, or a chat. It stays in Coolify.

### 4.2 Authorize the public key on the workload host

Choose one identity variant.

#### Variant R — root, key-only (official path)

Requires that root SSH login is enabled for keys. OCI Ubuntu images often disable it by default.

```sh
ssh <SSH_USER>@<WORKLOAD_HOST>
sudo -i
mkdir -p /root/.ssh
chmod 700 /root/.ssh
nano /root/.ssh/authorized_keys    # paste Coolify's public key on a new line
chmod 600 /root/.ssh/authorized_keys
```

If root login is disabled, edit `/etc/ssh/sshd_config`:

```ini
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

Then validate and reload, keeping the current session open:

```sh
sshd -t
systemctl restart ssh
```

Before closing the current session, open a second terminal and confirm:

```sh
ssh -i <coolify_private_key_test_copy> root@<WORKLOAD_HOST>
```

If you cannot test with Coolify's private key, confirm the public key is present and the service restarted; validation will be the real test.

#### Variant N — existing `devopsadmin` or a dedicated non-root user (experimental)

The workload host already uses `devopsadmin` with `docker` and `sudo` membership.

1. Add Coolify's public key to `/home/<user>/.ssh/authorized_keys` (mode 600, directory 700).
2. Confirm passwordless sudo works:

```sh
sudo -n true && echo "passwordless sudo OK"
```

Coolify's non-root remote-server support is documented as experimental. If validation fails or passwordless sudo is unavailable, fall back to Variant R.

**Security note:** membership in the `docker` group, or passwordless sudo, is effectively root-equivalent. This is required by Coolify's Docker deployment model. Restrict SSH source addresses accordingly.

---

## 5. Restrict Inbound SSH to the Control Plane

Do this only after key-based access works and a second session confirms it.

### 5.1 Determine the allowed source

- **A1 self-hosted:** the control plane's public egress IP, `<COOLIFY_CP_EGRESS_IP>`. If the IP is dynamic, document the residual risk and prefer a bastion or VPN; do not open SSH to the world as a permanent default.
- **A2 Coolify Cloud:** the published Coolify Cloud IPv4/IPv6 lists.

### 5.2 Apply at the OCI Security List (primary)

Restrict the TCP 22 ingress rule source to `<COOLIFY_CP_EGRESS_IP>/32` (and to the operator's own IP for administration, if needed). Keep 80 and 443 as they are.

Use the OCI Console or CLI. Do not remove the operator's own access path. Keep the console session open.

### 5.3 Host firewall

The repository documents UFW allowing 22, 80, 443 from anywhere. Tighten 22:

```sh
sudo ufw status numbered
# Identify the SSH rule, then restrict it after confirming the new source works.
```

Do not use plain UFW alone to protect Docker-published ports; Docker writes NAT rules that can bypass UFW. The official Coolify firewall guide recommends the provider firewall primarily and `ufw-docker` when no provider firewall exists.

### 5.4 Verify

From the control-plane/operator source:

```sh
ssh -p <SSH_PORT> <SSH_USER>@<WORKLOAD_HOST>
```

From an unrelated network, confirm SSH is refused. Keep the working session open until both checks pass.

---

## 6. Add the Workload Host as a Remote Server (Critical Ordering)

**Do not click Validate before setting the proxy to Custom (None).** Validation starts the selected proxy; the default is Traefik, which would try to bind 80/443 and conflict with Nginx.

### 6.0 Prepare for a brief Docker restart

Official Coolify documentation states that server validation can install Docker and **restart the Docker service**, making existing containers temporarily unavailable.

1. Take a fresh backup now:

```sh
/opt/devops-blog/scripts/backup-postgres.sh
```

2. Confirm the backup file and checksum exist under `/opt/devops-blog/backups`.
3. Confirm all production services are healthy:

```sh
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps
```

4. Open a maintenance window. Keep a second SSH session to the workload host open.
5. Record the current image digests and container health (Section 8 of `COOLIFY-ARCHITECTURE.md`) so you can prove nothing changed.

### 6.1 Create the server record

1. In Coolify: **Servers > New server > IP address or domain**.
2. Enter:
   - **Name:** `oci-devops-blog-workload`
   - **Description:** `Production OCI Ubuntu host; Nginx owns 80/443; proxy must be Custom (None)`
   - **IP address or domain:** `<WORKLOAD_HOST>` (no `http://` or `https://`)
   - **Port:** `<SSH_PORT>`
   - **User:** `<SSH_USER>` (root for Variant R, or the non-root user)
   - **Private key:** the key created in Section 4
   - **Server role:** **Deployments only** (keep builds on CI; do not build on the 1 GB host)
3. Select **Continue**. Coolify creates the record and opens **General**.

**Do not select Validate connection yet.**

### 6.2 Set the proxy to Custom (None) before validation

1. Open **Servers > oci-devops-blog-workload > Proxy**.
2. Select **Switch Proxy** and confirm the warning.
3. Choose **Custom (None)**.
4. Confirm the server stores proxy type `none`.

If the UI does not allow this before validation, use the documented API:

```sh
curl -fsS -X PATCH \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  -H "Content-Type: application/json" \
  "https://<COOLIFY_DASHBOARD_DOMAIN>/api/v1/servers/<SERVER_UUID>" \
  -d '{"proxy_type":"none"}'
```

The token needs `write` and `deploy` permissions. Do not paste the token into logs, tickets, or this repository. If unsure, stop and ask before using the API.

### 6.3 Pre-validate isolation check on the workload host

Before validation, confirm no Coolify proxy exists:

```sh
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -Ei 'coolify|traefik|caddy' || echo "no Coolify proxy containers"
sudo ss -tlnp | grep -E ':(80|443)\b'
```

Expected: only the existing Nginx/Docker proxy listeners on 80 and 443.

If a Coolify proxy container already exists and is binding ports, stop and follow Section 11 (Failure Handling) before validating.

### 6.4 Validate the connection

1. Open **Servers > oci-devops-blog-workload > General**.
2. Select **Validate connection**.
3. Wait for completion (several minutes).
4. Watch the workload host in the second session:

```sh
watch -n 5 'docker ps --format "{{.Names}}\t{{.Status}}" | sort'
```

Expect a brief Docker restart. `restart: unless-stopped` services should return automatically.

5. Confirm the General page reports **Server is reachable and validated**.

---

## 7. Verify Proxy Isolation and Production Health

Run on the workload host immediately after validation.

### 7.1 No Coolify proxy on the workload host

```sh
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -Ei 'coolify|traefik|caddy' || echo "PASS: no Coolify proxy containers"
```

### 7.2 Nginx still owns 80/443

```sh
sudo ss -tlnp | grep -E ':(80|443)\b'
```

Expected: only the existing Docker/Nginx listeners. No Traefik/Caddy process.

### 7.3 Containers and volumes unchanged

```sh
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps
docker volume ls | grep devops-blog-prod-postgres-data
docker network ls | grep devops-blog-prod-network
```

Expected: all services up and healthy; the same volume and network names as before.

### 7.4 Public smoke tests

```sh
curl -fsS -o /dev/null -w "homepage: %{http_code}\n" https://luffydev.duckdns.org/
curl -fsS https://luffydev.duckdns.org/api/health
curl -fsS -o /dev/null -w "posts: %{http_code}\n" https://luffydev.duckdns.org/api/posts
curl -sI http://luffydev.duckdns.org/ | head -n 1
```

Expected:

- homepage `200`,
- `/api/health` returns a healthy JSON body,
- `/api/posts` returns `200`,
- HTTP returns `301` to HTTPS.

### 7.5 No new public ports

```sh
sudo ss -tlnp | grep -vE ':(22|80|443)\b' | grep LISTEN || echo "no unexpected listeners"
sudo ufw status verbose
```

Expected: no new application or monitoring ports. Uptime Kuma remains on `127.0.0.1:3001`.

### 7.6 Coolify sees the server correctly

In Coolify:

- **Servers > oci-devops-blog-workload > General:** reachable and validated.
- **Servers > oci-devops-blog-workload > Proxy:** **Custom (None)**.
- No proxy container is displayed as running on this server.

---

## 8. Dashboard Hardening After Connection

- Dashboard reachable over HTTPS at `<COOLIFY_DASHBOARD_DOMAIN>`.
- Direct ports `8000`, `6001`, `6002` closed publicly or bound to localhost.
- Strong admin password and, if HTTPS is working, passkeys enabled.
- API tokens and SSH keys stored only in Coolify; not in the repository.
- Backups of `/data/coolify/source/.env` (A1) stored offline.
- Coolify's own Git auto-deploy stays disabled for the workload resource. Deployment is triggered only from GitHub Actions later (11.5).

---

## 9. Control-Plane Outage Behavior

- The workload Compose stack keeps running independently under `restart: unless-stopped`.
- Public traffic continues through the existing Nginx unless the workload host itself fails.
- New deployments are blocked until the control plane returns.
- Uptime Kuma keeps monitoring.
- Recovery: restore control-plane access first; do not modify the workload stack to compensate for a control-plane outage.

---

## 10. Abort Conditions

Stop and do not continue if any of the following occurs:

- A Coolify proxy container starts binding 80/443 on the workload host.
- Nginx or any production container does not return healthy after validation.
- `/api/health` or the homepage fails after validation.
- The PostgreSQL volume or network appears recreated or renamed.
- Coolify reports an SSH host-key mismatch that cannot be verified.
- Validation requires disabling host-key verification.
- You are about to open a new public port.

In an abort, see Section 11 before making further changes.

---

## 11. Failure Handling

### Validation shows `Permission denied (publickey)`

- Confirm the private key selected in Coolify matches the public key in the chosen user's `~/.ssh/authorized_keys`.
- Confirm the user and port.
- For Variant R, confirm `PermitRootLogin prohibit-password` and that OpenSSH restarted.
- For Variant N, confirm passwordless sudo.

### Validation times out

- Confirm `<WORKLOAD_HOST>` and `<SSH_PORT>`.
- Confirm the OCI Security List and UFW allow the control-plane source to reach 22.
- Confirm OpenSSH is running.

### A Coolify proxy appeared on the workload host

1. Do not stop Nginx.
2. In Coolify: **Servers > workload > Proxy > Stop Proxy**.
3. Select **Custom (None)**.
4. On the workload host, confirm port ownership:

```sh
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -Ei 'coolify|traefik|caddy'
sudo ss -tlnp | grep -E ':(80|443)\b'
```

5. Run the smoke tests in Section 7.4.
6. If ports were captured, restart the Nginx proxy container only:

```sh
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env restart proxy
```

Do not run `docker compose down`.

### Production containers did not come back after validation

```sh
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env ps
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env logs --tail=100 api
docker compose -f /opt/devops-blog/compose.yaml --env-file /opt/devops-blog/.env up -d
```

`up -d` reconciles missing containers without deleting volumes. Never use `-v`.

### Dashboard HTTPS certificate fails

- Confirm DNS points to `<CONTROL_PLANE_IP>`.
- Confirm control-plane ports 80/443 reach the Coolify proxy on localhost.
- Check **Servers > localhost > Proxy** is running on the control plane.
- Keep direct `:8000` access until HTTPS works.

### SSH lockout risk

- Keep the original session open.
- Revert the last firewall/SSH change from the open session.
- Use the OCI console as the final recovery path.
- Do not close the session until a second independent connection succeeds.

---

## 12. Rollback for 11.2

This phase adds a control plane and a server record; it should not alter the running stack.

If the connection must be undone:

1. In Coolify, remove the workload server record (this does not remove the existing Compose stack).
2. Confirm the workload host still has no Coolify proxy containers.
3. Remove Coolify's public key from the workload host's `authorized_keys`.
4. Revert any SSH source restriction to the previous known-good rule.
5. Verify production with the Section 7.4 smoke tests.
6. Record the rollback and reason.

Do not delete any production container, volume, network, certificate, or backup.

---

## 13. Operator Evidence

```text
Milestone 11.2 — Operator Evidence

Date/time (UTC): 2026-11-03 05:35:00 UTC
Operator: amarjeet

Control plane
- Implementation: A1 self-hosted (Canonical Multipass VM on macOS)
- OS / architecture: Ubuntu 24.04.5 LTS / aarch64 (Apple Silicon)
- CPU / RAM / disk: 2 vCPUs / 3.0 GB RAM / 20 GB NVMe Disk
- Dashboard URL: http://192.168.252.2:8000
- Direct ports closed: N/A (isolated private VM network)
- Install secrets backup confirmed: Yes (/data/coolify/source/.env)

SSH identity
- Workload SSH user / port: devopsadmin / 22
- Variant: N non-root (devopsadmin)
- Public key authorized: Yes (~/.ssh/authorized_keys)
- Host-key verification retained: Yes

Remote server
- Server name: oci-devops-blog-workload (IP: 129.154.253.114)
- Server role: Deployments only
- Proxy type before validation: none
- Proxy type confirmed in DB: {"type":"NONE","status":"exited"}
- Validation result: Reachable & validated (unreachable_count: 0)
- All workload services healthy after validation: Yes

Proxy isolation
- No coolify-proxy/traefik/caddy on workload host: Yes (none running)
- Ports 80/443 held only by Nginx/Docker proxy: Yes
- PostgreSQL volume name unchanged: Yes (devops-blog-prod-postgres-data)
- Network name unchanged: Yes (devops-blog-prod-network)
- No new public ports: Yes

Production smoke tests
- Homepage HTTP status: 200 OK
- /api/health body: {"status":"ok","database":"up","uptime":34997,"timestamp":"2026-11-03T05:34:17.818Z"}
- /api/posts status: 200 OK
- HTTP to HTTPS redirect: 301 Moved Permanently (Server: nginx)
- Uptime Kuma status: Healthy (127.0.0.1:3001)

Rollback/abort used: No
Follow-ups: Proceed to Milestone 11.3 (GHCR authentication and image release strategy)
```

---

## 14. Acceptance Checklist (11.2)

- [x] Dashboard is running with admin authentication established.
- [x] Coolify can reach the remote workload server via SSH.
- [x] Workload server is registered and validated.
- [x] Server role is **Deployments only**.
- [x] Proxy type on the workload server is **Custom (None)** (`type: "NONE"`).
- [x] No Coolify Traefik/Caddy container runs on the workload host.
- [x] Workload ports 80/443 remain owned by Nginx.
- [x] No new public application or monitoring ports.
- [x] PostgreSQL volume and network identities are unchanged.
- [x] Public homepage, `/api/health`, and `/api/posts` pass after validation.
- [x] Uptime Kuma remains healthy and loopback-bound.
- [x] Evidence recorded with secrets redacted.

---

## 15. Registry Authentication for the Deployment Server (Milestone 11.3)

Policy and tag/digest rules: `docs/operations/CI-CD-PIPELINE.md`. Steps here are operator actions only; no credentials are created or stored by the coding agent.

### 15.1 Determine package visibility first

From the workload host, as the user Coolify will connect as:

```sh
docker pull ghcr.io/amar1432/devops-blog-api:latest
docker pull ghcr.io/amar1432/devops-blog-web:latest
```

- Both succeed → packages are effectively public. Record that and skip 15.2–15.3.
- Either fails with `denied` → packages are private; continue to 15.2.

Also confirm visibility in the GitHub UI: repository → **Packages** (each package shows Public/Private).

### 15.2 Create a read-only package token (only if private)

1. GitHub → Settings → Developer settings → Personal access tokens.
2. Create a **dedicated** token for the deployment host:
   - Classic: scope `read:packages` only, or
   - Fine-grained: repository-scoped, Packages: Read only.
3. Copy it once. Do not commit it, paste it into tickets/logs, or reuse a developer token.
4. Note the creation date for the 90-day rotation schedule.

### 15.3 Log in as the exact Coolify SSH user

Docker reads credentials from `~/.docker/config.json` of the user that runs `docker login`. Coolify pulls happen over SSH as `<SSH_USER>`, so the login must be performed as that user:

```sh
ssh -p <SSH_PORT> <SSH_USER>@<WORKLOAD_HOST>
whoami                      # must be the Coolify SSH user
echo "<NEW_TOKEN>" | docker login ghcr.io -u <github-username> --password-stdin
chown <SSH_USER>:<SSH_USER> ~/.docker/config.json 2>/dev/null
chmod 600 ~/.docker/config.json
```

Never echo the token without `--password-stdin`, and never use flags that put the token in shell history.

### 15.4 Verify pulls and record

```sh
docker pull ghcr.io/amar1432/devops-blog-api:latest
docker pull ghcr.io/amar1432/devops-blog-web:latest
docker images --filter 'reference=ghcr.io/amar1432/*'
```

Record results (success/failure, digests after tags exist) in the Section 13 evidence template.

### 15.5 Rotation (90 days or on exposure)

```sh
docker logout ghcr.io
# create a new read-only token
echo "<NEW_TOKEN>" | docker login ghcr.io -u <github-username> --password-stdin
docker pull ghcr.io/amar1432/devops-blog-api:latest      # verify, then revoke the old token
```

Revoke old tokens in GitHub after each rotation. If the Coolify SSH user changes later, repeat 15.3 for the new user — credentials do not transfer between users.

### 15.6 Rules

- Only read scope on the deployment host; write access lives only in GitHub Actions (`GITHUB_TOKEN`).
- The token is unrelated to `COOLIFY_TOKEN` and must never be stored in GitHub Actions secrets for deployment use.
- If packages stay public, no token exists on the server — that is the preferred state.

---

## 16. References

- Self-hosted installation: <https://coolify.io/docs/start-with-self-hosted>
- Add a server: <https://coolify.io/docs/core/infrastructure/servers/add-server>
- OpenSSH for remote servers: <https://coolify.io/docs/core/infrastructure/servers/openssh>
- Firewall and ports: <https://coolify.io/docs/core/infrastructure/servers/firewall>
- Proxy overview and Custom (None): <https://coolify.io/docs/core/networking/proxy/overview>
- Custom proxy behavior: <https://coolify.io/docs/core/networking/proxy/custom/overview>
- Instance settings / dashboard domain: <https://coolify.io/docs/core/instance-management/instance-settings>
- Domains and dashboard domain: <https://coolify.io/docs/core/networking/domains>
- Coolify Cloud source addresses: <https://coolify.io/ipv4.txt> and <https://coolify.io/ipv6.txt>

Official documentation changes over time. Re-check these pages before executing the runbook.
