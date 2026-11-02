# DNS, Reverse Proxy, and HTTPS (Milestone 9)

This document provides a comprehensive operational and architectural guide to Milestone 9 of the `devops-blog` project. It covers domain configuration, DNS resolution mechanics, Nginx edge reverse proxy architecture, single-origin unified routing, Let's Encrypt TLS certificate provisioning via ACME HTTP-01, automated certificate renewal, firewall hardening, and verification of all operational experiments.

---

## 1. Production Architecture Overview

In Milestone 8, the frontend and API containers were exposed directly on separate host ports (`8080` and `5000`), requiring client-side cross-origin resource sharing (CORS) and exposing internal application servers to the public internet.

Milestone 9 establishes a **single-origin, hardened edge architecture**:

```text
                           Internet (Client Browser)
                                      |
                     DNS: luffydev.duckdns.org (A Record)
                                      |
                       Public IPv4: 129.154.253.114
                                      |
                      OCI VCN Security List (TCP 80, 443, 22)
                                      |
                      Ubuntu Host Firewall (UFW)
                                      |
                     +----------------+----------------+
                     |                                 |
              Port 80/tcp                       Port 443/tcp
             (HTTP Redirect &                  (TLS Termination &
              ACME Challenge)                   Single-Origin Proxy)
                     |                                 |
                     +----------------+----------------+
                                      |
                                      v
                       +-----------------------------+
                       |    Edge Reverse Proxy       |
                       |       (Nginx 1.27)          |
                       |  devops-blog-prod-proxy-1   |
                       +-----------------------------+
                                      |
                 devops-blog-prod-network (Private Docker Bridge)
                     +----------------+----------------+
                     |                                 |
           http://web:80                     http://api:5000
        (Path prefix: /*)                 (Path prefix: /api/*)
                     |                                 |
                     v                                 v
        +-------------------------+       +-------------------------+
        |   Web SPA Container     |       |   API Node.js Container |
        |  (Static Nginx/React)   |       |    (Express REST API)   |
        | devops-blog-prod-web-1  |       | devops-blog-prod-api-1  |
        +-------------------------+       +-------------------------+
                                                       |
                                            Internal TCP 5432
                                                       |
                                                       v
                                          +-------------------------+
                                          |   Database Container    |
                                          |     (PostgreSQL 16)     |
                                          |  devops-blog-prod-db-1  |
                                          +-------------------------+
                                                       |
                                                       v
                                            Named Persistent Volume
                                       (devops-blog-prod-postgres-data)
```

### Key Architectural Transformations:
1. **Single Origin (`https://luffydev.duckdns.org`)**: The browser interacts with one domain and one port (`443`). Frontend static assets and backend API requests share the identical protocol, domain, and port, completely eliminating CORS preflight overhead and mixed-content vulnerabilities.
2. **Container Isolation**: Host port mappings for Express (`5000`) and the static web container (`8080`) are **completely removed**. Application containers communicate exclusively across the internal bridge network `devops-blog-prod-network` using Docker embedded DNS (`web`, `api`, `db`).
3. **Edge TLS Termination**: The reverse proxy terminates TLS using Let's Encrypt certificates, offloading cryptographic operations from application runtimes and enforcing modern cryptographic suites (`TLSv1.2`, `TLSv1.3`, `HSTS`).

---

## 2. DNS Fundamentals & Resolution

### Domain Configuration
- **Domain Name**: `luffydev.duckdns.org`
- **DNS Provider**: DuckDNS (Dynamic DNS backed by AWS infrastructure)
- **Record Type**: `A` record
- **Target IPv4**: `129.154.253.114`
- **Time To Live (TTL)**: `60 seconds`

### Why DuckDNS fits Let's Encrypt:
`duckdns.org` is registered on the **Public Suffix List** (PSL). Let's Encrypt enforces rate limits per registered domain (e.g., maximum 50 certificates per domain per week). Because `duckdns.org` is on the PSL, each subdomain (such as `luffydev.duckdns.org`) is treated as an independent domain with its own separate rate-limit allocation.

### The Resolution Chain
When a client requests `https://luffydev.duckdns.org`:
1. **Local Resolver**: Client OS queries configured resolver (e.g., `1.1.1.1` or local gateway).
2. **Authoritative Resolution**: The resolver delegates queries down the DNS hierarchy to DuckDNS authoritative nameservers (`ns1.duckdns.org` through `ns9.duckdns.org`).
3. **Response**: An `A` record containing `129.154.253.114` is returned with a 60-second TTL.
4. **Caching & Propagation**: Due to the low 60-second TTL, changes made at the registrar propagate globally within 1 minute.

### Verification Evidence:
```bash
$ dig +short luffydev.duckdns.org @1.1.1.1
129.154.253.114

$ dig +short luffydev.duckdns.org @8.8.8.8
129.154.253.114
```

---

## 3. Reverse Proxy Architecture & Routing

### Nginx Configuration File (`deploy/nginx/default.conf`)

The production reverse proxy configuration resides at `/opt/devops-blog/nginx/default.conf` and is mounted read-only into the `proxy` container:

```nginx
# ==============================================================================
# Nginx Reverse Proxy Configuration — devops-blog
# Production TLS/HTTPS Configuration with Let's Encrypt & Single Origin Routing
# ==============================================================================

# ------------------------------------------------------------------------------
# HTTP (Port 80) — Redirect all traffic to HTTPS, except ACME challenges
# ------------------------------------------------------------------------------
server {
    listen 80;
    listen [::]:80;
    server_name luffydev.duckdns.org;

    server_tokens off;

    # ACME Challenge location for Let's Encrypt automated HTTP-01 renewals
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    # Permanent 301 redirect to HTTPS for all other traffic
    location / {
        return 301 https://$host$request_uri;
    }
}

# ------------------------------------------------------------------------------
# HTTPS (Port 443) — TLS Termination & Application Reverse Proxy
# ------------------------------------------------------------------------------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name luffydev.duckdns.org;

    server_tokens off;
    client_max_body_size 10m;

    # Let's Encrypt Certificates
    ssl_certificate /etc/letsencrypt/live/luffydev.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/luffydev.duckdns.org/privkey.pem;

    # Mozilla Intermediate TLS Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --------------------------------------------------------------------------
    # REST API Routing — Express Backend Container
    #
    # IMPORTANT: proxy_pass has NO trailing slash (http://api:5000).
    # This preserves the full request URI prefix (/api/...) as expected by
    # Express router handlers.
    # --------------------------------------------------------------------------
    location /api/ {
        proxy_pass http://api:5000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        proxy_hide_header X-Powered-By;
    }

    # --------------------------------------------------------------------------
    # Web Frontend Routing — Static React SPA
    #
    # Upstream web container handles static assets & React Router history fallback
    # --------------------------------------------------------------------------
    location / {
        proxy_pass http://web:80;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        proxy_hide_header X-Powered-By;
    }
}
```

### The Crucial Trailing Slash Difference in `proxy_pass`
Nginx handles URI rewriting differently based on whether the upstream target has a URI path:

| Directive Syntax | Client Request | Transmitted to Backend | Express Route Match | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `proxy_pass http://api:5000;` *(No trailing URI)* | `GET /api/posts` | `GET /api/posts` | `app.use("/api/posts", ...)` | **200 OK** |
| `proxy_pass http://api:5000/;` *(With trailing URI)* | `GET /api/posts` | `GET /posts` | `app.use("/api/posts", ...)` | **404 Not Found** |

Because the Express backend defines its route tree starting explicitly with `/api/`, `proxy_pass http://api:5000;` without a trailing URI is required to forward requests intact.

---

## 4. Docker Compose Production Configuration

The updated `/opt/devops-blog/compose.yaml` defines the reverse proxy and ACME architecture while keeping database volumes persistent:

```yaml
name: devops-blog-prod

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER must be set in .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env}
      POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB must be set in .env}
    volumes:
      - devops-blog-postgres-data:/var/lib/postgresql/data
    networks:
      - backend-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  api:
    image: ghcr.io/amar1432/devops-blog-api:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend-network
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set in .env}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1d}
      CORS_ORIGIN: ${CORS_ORIGIN:-https://luffydev.duckdns.org,http://luffydev.duckdns.org}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      ADMIN_NAME: ${ADMIN_NAME:-Site Admin}
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:5000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  web:
    image: ghcr.io/amar1432/devops-blog-web:latest
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    networks:
      - backend-network
    environment:
      VITE_API_URL: ${VITE_API_URL:-/api}
    command:
      [
        "sh",
        "-c",
        "if [ -n \"$$VITE_API_URL\" ]; then sed -i \"s|http://localhost:5000/api|$$VITE_API_URL|g\" /usr/share/nginx/html/assets/*.js; fi && exec nginx -g 'daemon off;'",
      ]
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      web:
        condition: service_healthy
      api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-etc:/etc/letsencrypt
      - certbot-www:/var/www/certbot
    networks:
      - backend-network
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  certbot:
    image: certbot/certbot:latest
    restart: "no"
    volumes:
      - certbot-etc:/etc/letsencrypt
      - certbot-www:/var/www/certbot
    networks:
      - backend-network

networks:
  backend-network:
    name: devops-blog-prod-network
    driver: bridge

volumes:
  devops-blog-postgres-data:
    name: devops-blog-prod-postgres-data
  certbot-etc:
    name: devops-blog-prod-certbot-etc
  certbot-www:
    name: devops-blog-prod-certbot-www
```

---

## 5. TLS Certificate Acquisition & Automated Renewal

### ACME HTTP-01 Challenge Process
Let's Encrypt validates domain control via the **ACME HTTP-01** challenge:
1. Certbot initiates a session with the Let's Encrypt CA requesting a certificate for `luffydev.duckdns.org`.
2. Let's Encrypt CA returns a random challenge token.
3. Certbot writes the token into the shared webroot volume:
   `/var/www/certbot/.well-known/acme-challenge/<TOKEN>`
4. Let's Encrypt makes an HTTP request to `http://luffydev.duckdns.org/.well-known/acme-challenge/<TOKEN>`.
5. Nginx serves this request over port 80 directly from the shared volume.
6. CA verifies the token, signs the certificate chain, and returns `fullchain.pem` and `privkey.pem`.

### Acquisition Command:
```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d luffydev.duckdns.org \
  --email amarjeet7810@gmail.com \
  --agree-tos \
  --no-eff-email
```

### Verified Certificate Metadata:
```text
Signature Algorithm: ecdsa-with-SHA384
Issuer: C=US, O=Let's Encrypt, CN=YE2
Not Before: Nov  2 16:39:11 2026 GMT
Not After : Jan 31 16:39:10 2027 GMT
Subject: CN=luffydev.duckdns.org
Subject Alternative Name: DNS:luffydev.duckdns.org
```

### Automated Renewal Strategy
Certificates expire every 90 days. We automated renewal via `/etc/cron.d/certbot-renew` running daily at 03:00 UTC:

```cron
# /etc/cron.d/certbot-renew
0 3 * * * devopsadmin cd /opt/devops-blog && docker compose run --rm certbot renew --quiet --no-random-sleep-on-renew && docker compose exec -T proxy nginx -s reload
```

- When certificate validity is >30 days, `certbot renew` exits silently with no renewal needed.
- When validity drops below 30 days, Certbot completes the challenge, updates files in `certbot-etc`, and triggers `nginx -s reload` to refresh active TLS worker processes without dropping connections.

---

## 6. Firewall & Security Hardening

Security enforcement operates across two distinct layers:

### Layer 1: Oracle Cloud Infrastructure (OCI) VCN Security List
OCI gateway filters all incoming packets prior to reaching the virtual machine:
- **TCP Port 22**: SSH Remote Administration
- **TCP Port 80**: HTTP reverse proxy (ACME challenges & HTTPS redirect)
- **TCP Port 443**: HTTPS reverse proxy
- *(Old rules for ports 8080 and 5000 removed)*

### Layer 2: Host Firewall (UFW)
```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere                   # Allow SSH management
80/tcp                     ALLOW IN    Anywhere                   # HTTP reverse proxy and ACME
443/tcp                    ALLOW IN    Anywhere                   # HTTPS reverse proxy
22/tcp (v6)                ALLOW IN    Anywhere (v6)              # Allow SSH management
80/tcp (v6)                ALLOW IN    Anywhere (v6)              # HTTP reverse proxy and ACME
443/tcp (v6)               ALLOW IN    Anywhere (v6)              # HTTPS reverse proxy
```

### External Security Port Scan Verification:
A full TCP port probe from an external workstation confirmed strict isolation:

| Target Port | Service | Expected Public State | Live Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **22** | OpenSSH | Open | **OPEN** (10ms latency) | **PASS** |
| **80** | Nginx HTTP Redirect / ACME | Open | **OPEN** | **PASS** |
| **443** | Nginx HTTPS Reverse Proxy | Open | **OPEN** (HTTP/2) | **PASS** |
| **5000** | Express API Container | Closed | **CLOSED / FILTERED** | **PASS** |
| **8080** | React Web Container | Closed | **CLOSED / FILTERED** | **PASS** |
| **5432** | PostgreSQL 16 Database | Closed | **CLOSED / FILTERED** | **PASS** |

---

## 7. Operational Experiments & Live Observed Results

All eight experiments specified in `MILESTONE-9-SPEC.md` were executed and verified on the production server:

### Experiment 1: DNS Record Modification & Resolution
- **Action**: Modified DuckDNS record from initial home IP (`152.59.147.230`) to cloud server IP (`129.154.253.114`).
- **Observed**: Due to the 60s TTL, recursive resolvers (`1.1.1.1` and `8.8.8.8`) propagated the new IP globally within 60 seconds.

### Experiment 2: Stop API Container & Inspect Reverse Proxy
- **Action**: `docker compose stop api`, probed both `/api/health` and `/`.
- **Observed**: Nginx immediately returned `HTTP/2 504 Gateway Timeout` for `/api/health`. The frontend (`/`) continued serving `HTTP/2 200 OK` without interruption. Running `docker compose start api` restored `/api/health` to `200 OK` in 3 seconds.

### Experiment 3: Stop Frontend Container & Inspect Reverse Proxy
- **Action**: `docker compose stop web`, probed both `/` and `/api/health`.
- **Observed**: Nginx returned `HTTP/2 504 Gateway Timeout` for `/`. The API (`/api/health`) continued returning `HTTP/2 200 OK` and serving database queries. Running `docker compose start web` restored frontend operations.

### Experiment 4: Restart Nginx Reverse Proxy
- **Action**: `docker compose restart proxy`.
- **Observed**: The Nginx container restarted in place in 1.4 seconds. Upstream services (`web`, `api`, `db`) experienced zero downtime, and subsequent requests succeeded immediately.

### Experiment 5: HTTP-to-HTTPS Redirect Preservation
- **Action**: Probed HTTP endpoints with `curl -sI`.
- **Observed**:
  - `http://luffydev.duckdns.org/` $\rightarrow$ `301 Moved Permanently` $\rightarrow$ `https://luffydev.duckdns.org/`
  - `http://luffydev.duckdns.org/posts/rise-of-the-ai` $\rightarrow$ `301 Moved Permanently` $\rightarrow$ `https://luffydev.duckdns.org/posts/rise-of-the-ai`
  - Request paths and query parameters are strictly preserved.

### Experiment 6: Certificate Metadata & Expiry
- **Action**: Analyzed TLS handshake using `openssl s_client`.
- **Observed**: Valid TLS certificate issued by Let's Encrypt intermediate authority `YE2`, valid until `Jan 31 16:39:10 2027 GMT`, with ECDSA SHA-384 cryptography.

### Experiment 7: Certificate Renewal Dry Run
- **Action**: Executed `docker compose run --rm certbot renew --dry-run`.
- **Observed**: ACME HTTP-01 challenge simulated against Let's Encrypt staging servers. Nginx served the test challenge from `/var/www/certbot`, and Certbot reported:
  `Congratulations, all simulated renewals succeeded: /etc/letsencrypt/live/luffydev.duckdns.org/fullchain.pem (success)`.

### Experiment 8: Full Server Reboot & Zero-Touch Recovery
- **Action**: Executed `sudo reboot` on the remote Ubuntu host.
- **Observed**:
  - Cloud VM power-cycled and resumed OpenSSH in ~35 seconds.
  - Docker daemon started upon boot and automatically launched all four containers: `db`, `api`, `web`, and `proxy` via `restart: unless-stopped`.
  - Database volume `devops-blog-prod-postgres-data` remained intact.
  - Probed `https://luffydev.duckdns.org/` and `https://luffydev.duckdns.org/api/posts` immediately returned HTTP 200 and all previously saved posts, confirming complete zero-touch recovery.

---

## 8. Browser Verification via Chrome DevTools MCP

End-to-end user workflows were verified inside an automated headless Chrome session:
1. **Initial Page Load**: Navigated to `https://luffydev.duckdns.org/`. All assets (`index-*.js`, `index-*.css`) loaded via HTTP/2 200.
2. **Network Request Single Origin**: Probed browser network traffic; 100% of requests targeted `https://luffydev.duckdns.org`.
3. **Console Hygiene**: Inspected console logs; zero mixed-content errors or CORS warnings observed.
4. **Administrative Login**: Completed form submission with admin credentials; JWT token stored and session activated.
5. **Blog Post CRUD**: Created new post *"Milestone 9: HTTPS & Reverse Proxy Secured 🚀"*, published it, and viewed it at `https://luffydev.duckdns.org/posts/milestone-9-https-reverse-proxy-secured`.

---

## 9. Known Limitations & Next Steps

1. **Ephemeral DynDNS Domain**: While `luffydev.duckdns.org` provides full Let's Encrypt support and valid public routing, it relies on a shared third-party dynamic DNS provider rather than a dedicated corporate top-level domain.
2. **Single Host Deployment**: The entire stack runs on a single OCI instance. While containers isolate failures, physical server downtime halts all services until the instance reboots.
3. **Manual File Syncing**: Nginx configuration and Compose changes were synced manually via SSH/SCP. Milestone 10 will explore automated deployment pipelines and container management workflows.
