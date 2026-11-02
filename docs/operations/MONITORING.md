# Availability Monitoring with Uptime Kuma

This runbook documents the deployment, security model, monitor configuration, notification integration, and failure verification procedures for availability monitoring using **Uptime Kuma** in the `devops-blog` production environment.

---

## 1. Architecture & Design

Uptime Kuma runs as an internal container alongside the existing production stack on the Oracle Cloud Infrastructure (OCI) Ubuntu VM.

```text
                                  Internet
                                     |
                                  OCI VCN
                        [Open Ports: 80, 443, 22]
                                     |
               +---------------------+---------------------+
               |                     |                     |
          HTTP (Port 80)      HTTPS (Port 443)       SSH (Port 22)
               |                     |                     |
         Redirect to 443       Nginx Proxy                 |
                               /          \           Encrypted Tunnel
                         React Web    Express API     (Local Port Forwarding)
                                           |               |
                                      PostgreSQL           |
                                                           v
                                            [Host Loopback 127.0.0.1:3001]
                                                           |
                                                      Uptime Kuma
                                                           |
                                              devops-blog-prod-uptime-kuma-data
                                                     (Named Docker Volume)
```

### Security Boundary Rationale:
1. **No Public Ingress**: Uptime Kuma's management interface is bound strictly to `127.0.0.1:3001` on the host. It is **not** exposed to `0.0.0.0`, nor routed through the public Nginx proxy.
2. **Zero Firewall Modifications**: Neither the OCI VCN Security List nor the host UFW firewall require port 3001 to be opened.
3. **Encrypted Admin Access**: Operators access the management dashboard through an authenticated SSH tunnel, leveraging SSH key authentication before reaching Uptime Kuma's login screen.
4. **Persistent State**: Application data, monitor history, credentials, and notification settings reside in the dedicated named volume `devops-blog-prod-uptime-kuma-data`, surviving container recreation and host reboots.

---

## 2. Docker Compose Configuration

The service definition in `/opt/devops-blog/deploy/compose.yaml`:

```yaml
  uptime-kuma:
    image: louislam/uptime-kuma:1.23.16
    restart: unless-stopped
    ports:
      # Bound to loopback interface only
      - "127.0.0.1:${UPTIME_KUMA_HOST_PORT:-3001}:3001"
    volumes:
      - uptime-kuma-data:/app/data
    networks:
      - backend-network

volumes:
  uptime-kuma-data:
    name: devops-blog-prod-uptime-kuma-data
```

---

## 3. Deployment & Operator Commands

### Step 1: Pull Image and Start Service
On the production server (`/opt/devops-blog`):

```bash
cd /opt/devops-blog
docker compose -f deploy/compose.yaml pull uptime-kuma
docker compose -f deploy/compose.yaml up -d uptime-kuma
```

### Step 2: Verify Service Status and Network Binding
Verify that the container is healthy and bound strictly to `127.0.0.1`:

```bash
# 1. Check container status
docker compose -f deploy/compose.yaml ps uptime-kuma

# 2. Verify port listening strictly on 127.0.0.1:3001 (NOT 0.0.0.0:3001)
ss -tulpn | grep 3001
```

**Expected output:**
```text
LISTEN 0 4096 127.0.0.1:3001 0.0.0.0:* users:(("docker-proxy",pid=...,fd=...))
```
> [!IMPORTANT]
> If `ss` shows `0.0.0.0:3001` or `*:3001`, stop immediately. Port 3001 must only listen on `127.0.0.1`.

---

## 4. Accessing the Dashboard via SSH Tunnel

Because port 3001 is bound to the loopback interface, access the dashboard from your local workstation using SSH local port forwarding:

```bash
# On your local laptop/workstation:
ssh -N -L 3001:127.0.0.1:3001 ubuntu@129.154.253.114
```

*Flags explained:*
- `-N`: Do not execute a remote shell command (port forwarding only).
- `-L 3001:127.0.0.1:3001`: Map local port `3001` on your machine to `127.0.0.1:3001` on the remote server.

Once connected, open your browser and navigate to:
```text
http://127.0.0.1:3001
```

---

## 5. Initial Setup & Monitor Configuration

### Step 1: Create Admin Account
On first load, Uptime Kuma prompts for initial admin setup:
- Create a strong administrative username and a high-entropy password.
- Do not disable authentication.

### Step 2: Configure Public Frontend Monitor
- **Monitor Type**: `HTTP(s)`
- **Friendly Name**: `DevOps Blog Frontend`
- **URL**: `https://luffydev.duckdns.org/`
- **Heartbeat Interval**: `60` seconds
- **Retries**: `1`
- **Heartbeat Retry Interval**: `20` seconds
- **Accepted Status Codes**: `200-299`
- **Certificate Expiry Notification**: Enabled (alerts when TLS cert is within 14 days of expiry)

### Step 3: Configure API Health Monitor
- **Monitor Type**: `HTTP(s)`
- **Friendly Name**: `DevOps Blog API Health`
- **URL**: `https://luffydev.duckdns.org/api/health`
- **Heartbeat Interval**: `60` seconds
- **Retries**: `1`
- **Heartbeat Retry Interval**: `20` seconds
- **Accepted Status Codes**: `200-299`

### Timing and Detection Window:
- **Interval**: 60 seconds
- **Max Retries before DOWN**: 1 retry (waiting 20 seconds)
- **Worst-case detection window**: ~80 seconds from service failure to confirmed DOWN notification.

---

## 6. Alert Notification Provider Setup

Configure notifications in Uptime Kuma: **Settings → Notifications → Setup Notification**.

Recommended providers:
- **Discord / Slack / Telegram / Email / Webhook / Apprise**

### Operational Security Rules:
1. **Never commit webhook URLs, bot tokens, or SMTP passwords into Git.**
2. Webhooks and tokens are entered exclusively into Uptime Kuma's web UI.
3. Secrets are stored inside the encrypted/protected SQLite database inside `uptime-kuma-data`.
4. Run a **Test Notification** via the button in Uptime Kuma to verify delivery before closing the setup.

---

## 7. Verification & Failure Simulation Procedure

To verify that the monitoring and alerting system operates correctly without risking production data or affecting the public web frontend, perform this controlled test:

### Step 1: Baseline Check
Confirm in the dashboard that both `DevOps Blog Frontend` and `DevOps Blog API Health` are green (**UP**).

### Step 2: Simulate Failure (Stop API Service Only)
On the server:
```bash
docker compose -f deploy/compose.yaml stop api
```

### Step 3: Observe Failure Signal
1. Frontend `https://luffydev.duckdns.org/` remains **UP** (served by static Nginx).
2. API Health `https://luffydev.duckdns.org/api/health` switches to **DOWN** within ~60–80 seconds (502 Bad Gateway from Nginx).
3. The configured notification channel receives a **[DOWN] DevOps Blog API Health** alert.

### Step 4: Recover Service (Start API Service)
On the server:
```bash
docker compose -f deploy/compose.yaml start api
```

### Step 5: Observe Recovery Signal
1. Monitor transitions back to **UP** on the next heartbeat cycle.
2. The configured notification channel receives an **[UP] DevOps Blog API Health** recovery alert.

### Step 6: Verify Data Persistence
Test that configuration survives container recreation:
```bash
# Recreate the container
docker compose -f deploy/compose.yaml down uptime-kuma
docker compose -f deploy/compose.yaml up -d uptime-kuma
```
Refresh `http://127.0.0.1:3001` via the SSH tunnel:
- Admin login and monitors remain fully intact.
- Historical heartbeat records remain preserved in the `devops-blog-prod-uptime-kuma-data` volume.
