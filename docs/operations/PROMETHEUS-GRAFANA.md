# Metrics Observability with Prometheus & Grafana

This runbook documents the deployment, security boundaries, metric collection pipelines, Grafana dashboard provisioning, and operational procedures for metrics observability using **Prometheus**, **Grafana**, **Node Exporter**, and **PostgreSQL Exporter** across local development and production environments.

---

## 1. Architecture & Design

The observability stack runs as internal container services alongside the application and database workloads.

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
                               /          \           Encrypted Tunnels
                         React Web    Express API     (Local Port Forwarding)
                                           |               |
                                      PostgreSQL           |
                                                           v
                                            [Host Loopback 127.0.0.1]
                                            +-- Grafana (:3000)
                                            +-- Prometheus (:9090)
                                            +-- Node Exporter (:9100)
                                            +-- PostgreSQL Exporter (:9187)
```

### Security Boundary Rationale:
1. **Zero Public Ingress**: Neither Prometheus (:9090) nor Grafana (:3000) are exposed to `0.0.0.0` or routed via public Nginx. All ports are bound strictly to host loopback `127.0.0.1`.
2. **Encrypted Operator Access**: Operators access Grafana and Prometheus web interfaces via SSH tunnels (`ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 <host>`).
3. **Internal Container Network**: Exporters and scrapers communicate over the internal bridge network (`devops-blog-compose-network` in dev, `devops-blog-prod-network` in production).
4. **Strict Resource Bounds**: In production, containers are constrained with explicit memory limits (`deploy.resources.limits.memory`) to prevent out-of-memory events on memory-constrained virtual machines (e.g. 1 GB RAM OCI tier).

---

## 2. Metric Collection Pipeline

### 1. Express API Metrics (`devops-blog-api`)
- **Library**: `prom-client`
- **Scrape Path**: `/api/metrics`
- **Runtime Metrics**: CPU usage, Heap allocation (`nodejs_heap_size_used_bytes`), Resident Set Size (`process_resident_memory_bytes`), and Event Loop Lag (`nodejs_eventloop_lag_p99_seconds`).
- **Application RED Metrics**:
  - `http_requests_total`: Counter partitioned by `method`, `route`, and `status_code`.
  - `http_request_duration_seconds`: Histogram measuring latency buckets `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`.
  - `http_active_requests`: Gauge tracking concurrent in-flight requests.
- **Cardinality Protection**: Dynamic path parameters (e.g. `/api/posts/:slug`) are normalized using Express route definitions to prevent metric cardinality explosion.

### 2. Host & System Metrics (`node-exporter`)
- **Image**: `prom/node-exporter:v1.9.0`
- **Metrics Collected**: CPU mode times, memory and swap consumption, root filesystem usage, disk I/O throughput, and network interface traffic.

### 3. PostgreSQL Database Metrics (`postgres-exporter`)
- **Image**: `prometheuscommunity/postgres-exporter:v0.16.0`
- **Connection**: `DATA_SOURCE_NAME="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?sslmode=disable"`
- **Metrics Collected**: Active client connections (`pg_stat_activity_count`), transaction commit/rollback rates (`pg_stat_database_xact_commit`), database size, and buffer cache hit ratio.

---

## 3. Pre-Provisioned Grafana Dashboards

Dashboards are automatically provisioned from [`deploy/monitoring/grafana/dashboards/`](file:///Users/amarjeet/Desktop/devops/deploy/monitoring/grafana/dashboards):

| Dashboard | File | Metrics Covered |
|-----------|------|-----------------|
| **Express API Metrics** | `api-metrics.json` | Request throughput (RPS), 4xx/5xx error rates, p50/p95/p99 latency percentiles, route breakdown, active requests, Node.js heap memory, and event loop lag. |
| **Host & System Resources** | `host-metrics.json` | CPU utilization (%), memory utilization (%), root disk space (%), 1m system load, memory breakdown (buffers/cache/free), and network traffic I/O. |
| **PostgreSQL Metrics** | `postgres-metrics.json` | Active connections, buffer cache hit ratio (%), database size, active table locks, commit/rollback rates, and tuple activity (fetch/insert/update/delete). |

Datasource configuration is provisioned automatically at [`deploy/monitoring/grafana/provisioning/datasources/datasources.yml`](file:///Users/amarjeet/Desktop/devops/deploy/monitoring/grafana/provisioning/datasources/datasources.yml).

---

## 4. Operational Commands

### Local Development (Hybrid & Compose Workflow)

Start the monitoring infrastructure alongside the database:
```bash
docker compose --env-file .env.compose up -d db prometheus grafana node-exporter postgres-exporter
```

Run the Express API locally on host with Bun:
```bash
bun run dev:api
```
*(Prometheus automatically scrapes the host API via `host.docker.internal:4000`)*

Access Grafana locally:
- **URL**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Default Credentials**: `admin` / `admin`

Access Prometheus locally:
- **URL**: [http://127.0.0.1:9090](http://127.0.0.1:9090)

---

### Production Deployment (Server / OCI)

On the production server (`/opt/devops-blog`):

1. Pull images and launch services:
```bash
cd /opt/devops-blog
docker compose -f deploy/compose.yaml pull prometheus grafana node-exporter postgres-exporter
docker compose -f deploy/compose.yaml up -d prometheus grafana node-exporter postgres-exporter
```

2. Verify loopback bindings:
```bash
ss -tulpn | grep -E "3000|9090|9100|9187"
```
*Confirm all ports listen strictly on `127.0.0.1`, never on `0.0.0.0`.*

3. Open SSH tunnel from your local machine to access Grafana and Prometheus:
```bash
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 ubuntu@<server-ip>
```
Open [http://localhost:3000](http://localhost:3000) in your workstation browser.

---

## 5. Verification & Health Checks

Test scrape targets from Prometheus API:
```bash
curl -s http://127.0.0.1:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, url: .scrapeUrl}'
```

Test application metrics endpoint directly:
```bash
curl -s http://127.0.0.1:4000/api/metrics | grep -E "http_requests_total|nodejs_heap_size_used_bytes"
```

Run test suite:
```bash
bun --cwd apps/api test tests/api/metrics.api.test.js
```
