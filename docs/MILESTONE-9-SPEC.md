# Milestone 9 — DNS, Reverse Proxy, and HTTPS

## Objective

Configure a domain name, DNS records, Nginx reverse proxy, and HTTPS certificates for the manually deployed `devops-blog` application.

The target outcome is a secure, single-origin deployment:

- `https://blog.example.com/` → Frontend
- `https://blog.example.com/api/...` → Backend API

## Existing infrastructure

- OCI Ubuntu server
- Docker Engine and Docker Compose
- GHCR frontend and API images
- PostgreSQL with persistent Docker volume
- Existing manual deployment at Milestone 8

## Phase 1 — DNS fundamentals

Learn:

- Domain names and registrars
- DNS resolution
- A and AAAA records
- CNAME records
- DNS TTL
- Authoritative nameservers
- Recursive DNS resolvers
- DNS propagation and caching

Practical tasks:

1. Identify a domain you own and can configure.
2. Create an A record pointing to the server's public IPv4 address.
3. Optionally create a `www` or `blog` subdomain.
4. Inspect DNS resolution using `dig` and `nslookup`.
5. Compare answers from different public DNS resolvers.
6. Understand why DNS changes may not appear immediately.

Do not purchase a domain or paid service without explicit approval.

## Phase 2 — Reverse proxy fundamentals

Understand:

- What a reverse proxy is.
- Forward proxy vs reverse proxy.
- How Nginx accepts incoming requests.
- How Nginx forwards requests to upstream services.
- Host-based and path-based routing.
- Proxy headers.
- Web server vs application server.

Configure Nginx with two routes:

- `/` → frontend container
- `/api/` → backend API container

Preserve the API path correctly. Verify whether the backend expects `/api` in its route paths before configuring `proxy_pass`.

## Phase 3 — Docker network architecture

Refactor the existing Compose deployment:

- Introduce a dedicated reverse proxy service.
- Publish only ports 80 and 443 on the public host.
- Remove public host port mappings for the frontend and API.
- Keep frontend, API, and database communication on private Docker networks.
- Keep PostgreSQL without a public port.
- Preserve the existing PostgreSQL named volume.
- Do not rebuild application images unnecessarily.
- Keep the deployment restart policies and health checks.

The reverse proxy should communicate with frontend and API using Compose service names.

## Phase 4 — HTTP reverse proxy

1. Create an Nginx configuration.
2. Route frontend requests to the web service.
3. Route API requests to the API service.
4. Forward appropriate headers:
   - Host
   - X-Real-IP
   - X-Forwarded-For
   - X-Forwarded-Proto
5. Verify routing over HTTP.
6. Verify SPA routes still work after refreshing the browser.
7. Verify API responses and authentication work.

## Phase 5 — HTTPS and TLS

Use Let's Encrypt certificates with an appropriate ACME client, such as Certbot or a carefully configured automated certificate workflow.

Understand:

- TLS handshake
- Public/private key roles
- Certificate chains
- Certificate authorities
- Certificate expiration
- ACME HTTP-01 challenge
- Certificate renewal

Tasks:

1. Ensure DNS resolves to the server.
2. Permit inbound TCP 80 and 443 at the OCI and host firewall layers.
3. Obtain a certificate for the configured domain.
4. Configure Nginx to listen on HTTPS.
5. Redirect HTTP requests to HTTPS.
6. Verify the certificate chain and hostname.
7. Verify certificate renewal works.
8. Ensure renewal reloads or otherwise updates Nginx correctly.

Never disable TLS verification to make a test pass.

## Phase 6 — Application configuration

Update the frontend API URL to use a relative path such as `/api`.

Ensure:

- The browser uses the same HTTPS origin for API requests.
- CORS configuration is correct for the final origin.
- JWT authentication works over HTTPS.
- No HTTP API URLs remain in the built frontend assets.
- HTTP requests redirect to HTTPS.

Review the existing frontend runtime replacement logic from Milestone 8 and simplify it if appropriate.

## Phase 7 — Security validation

Verify:

- Only ports 22, 80, and 443 are publicly reachable.
- Frontend port 8080 is not publicly exposed.
- API port 5000 is not publicly exposed.
- PostgreSQL port 5432 is not publicly exposed.
- HTTPS works without browser certificate warnings.
- HTTP redirects to HTTPS.
- Nginx does not expose sensitive server files.
- Secrets and certificates are not committed to Git.
- Existing SSH access remains available.

## Phase 8 — Operational experiments

Perform and document:

1. Change a DNS record and observe resolution.
2. Stop the API container and inspect reverse proxy behavior.
3. Stop the frontend container and inspect reverse proxy behavior.
4. Restart Nginx and verify recovery.
5. Test HTTP-to-HTTPS redirect.
6. Inspect certificate metadata and expiry.
7. Perform a certificate renewal dry run.
8. Reboot the server and verify the full stack recovers.

## Documentation

Create:

`docs/DNS-REVERSE-PROXY-HTTPS.md`

Include:

- DNS architecture and records
- Reverse proxy architecture
- Nginx configuration
- Docker network changes
- TLS certificate acquisition
- Certificate renewal strategy
- Firewall changes
- Security validation results
- Troubleshooting
- Operational experiments
- Known limitations

Do not commit private keys, certificate private material, DNS credentials, or application secrets.

## Acceptance criteria

- [ ] Domain resolves to the server.
- [ ] Nginx reverse proxy is operational.
- [ ] Frontend works through the domain.
- [ ] API works through the same domain.
- [ ] Frontend and API host ports are no longer publicly exposed.
- [ ] PostgreSQL remains private.
- [ ] HTTPS certificate is valid.
- [ ] HTTP redirects to HTTPS.
- [ ] Login and blog CRUD work over HTTPS.
- [ ] Certificate renewal is tested.
- [ ] Reboot recovery is verified.
- [ ] Documentation is complete.

## Out of scope

- GitHub Actions remote deployment
- Coolify
- Kubernetes
- Terraform / Ansible
- Advanced WAF or CDN
- High availability
- Multi-server deployment