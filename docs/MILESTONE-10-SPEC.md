# Milestone 10 --- Production Observability, Backup & Disaster Recovery

**Project:** `devops-blog`\
**Status:** Ready for implementation\
**Milestone:** 10\
**Predecessor:** Milestone 9 --- DNS, Reverse Proxy, and HTTPS\
**Primary environment:** Oracle Cloud Infrastructure (OCI), Ubuntu,
Docker Compose\
**Domain:** `luffydev.duckdns.org`

------------------------------------------------------------------------

## 1. Purpose

Milestone 10 turns the existing single-host production deployment into
an observable and recoverable service.

The goal is not merely to install monitoring software. The goal is to
establish repeatable operational practices for:

-   Detecting application and infrastructure failures.
-   Diagnosing incidents using container and reverse-proxy logs.
-   Understanding host resource pressure.
-   Producing consistent PostgreSQL backups.
-   Proving that backups can be restored.
-   Recovering from broken application deployments and configuration
    changes.
-   Recording incidents, evidence, and operational procedures.

The milestone follows the established learning cycle:

**Understand → Implement → Experiment → Document → Verify**

## 2. Existing production baseline

Milestone 9 established the following deployment:

-   OCI Ubuntu VM.
-   Public domain: `luffydev.duckdns.org`.
-   Public IPv4 documented in the Milestone 9 report.
-   Docker Compose project: `devops-blog-prod`.
-   Docker network: `devops-blog-prod-network`.
-   Services:
    -   `proxy`: Nginx 1.27 Alpine, public ports 80 and 443.
    -   `web`: React SPA served by Nginx, internal port 80.
    -   `api`: Node.js/Express REST API, internal port 5000.
    -   `db`: PostgreSQL 16 Alpine, internal port 5432.
    -   `certbot`: one-shot certificate operations.
-   Persistent PostgreSQL volume: `devops-blog-prod-postgres-data`.
-   Let's Encrypt certificate and ACME webroot volumes.
-   Application containers are not directly exposed on public host
    ports.
-   Nginx routes `/api/*` to `api:5000` and other requests to `web:80`.
-   The API health endpoint is `/api/health`.
-   The public application is served over HTTPS.
-   Containers use restart policies for reboot recovery.

**Important:** Treat the current production configuration and Milestone
9 documentation as the source of truth. Inspect the live repository and
server configuration before proposing changes. Do not assume that the
current files exactly match examples in this specification.

## 3. Goals

By the end of Milestone 10, the operator must be able to:

1.  Detect when the public website or API becomes unavailable.
2.  Receive and verify availability notifications.
3.  inspect logs from each application service and Nginx.
4.  Identify common HTTP failures such as 404, 502, and 504.
5.  Inspect CPU, memory, disk, and container resource usage.
6.  Create automated, timestamped PostgreSQL backups.
7.  Apply and verify a backup retention policy.
8.  Restore a backup into an isolated target and validate the recovered
    data.
9.  Explain and execute a safe application rollback.
10. Run controlled failure simulations and produce incident reports.

## 4. Non-goals

The following are deliberately outside this milestone:

-   Kubernetes, Helm, or multi-node orchestration.
-   High availability or multi-region architecture.
-   A full Prometheus/Grafana observability stack.
-   Distributed tracing.
-   A production SIEM or security analytics platform.
-   Automated blue/green or canary deployments.
-   Replacing the existing deployment process with a new deployment
    platform.
-   Exposing internal application, database, or monitoring ports
    publicly.

Prometheus/Grafana may be explored later as an advanced extension, but
they are not required for Milestone 10 completion.

## 5. Scope and implementation phases

### 10.1 --- Availability monitoring with Uptime Kuma

**Objective:** Detect public application and API availability failures.

Requirements:

-   Deploy Uptime Kuma using Docker Compose.
-   Persist Uptime Kuma application data in a named Docker volume.
-   Add the service without changing the existing public routing
    behavior.
-   Configure an HTTP monitor for `https://luffydev.duckdns.org/`.
-   Configure an HTTP monitor for
    `https://luffydev.duckdns.org/api/health`.
-   Configure an alert notification provider selected by the operator.
-   Test DOWN and UP transitions by stopping and starting the API
    container.
-   Document monitor intervals, retry/heartbeat behavior, and
    notification delivery.

Security requirements:

-   Do not publish the Uptime Kuma management port to `0.0.0.0`.
-   Prefer binding its host port to `127.0.0.1` and accessing it through
    an SSH tunnel, or use an explicitly designed authenticated HTTPS
    access path.
-   Do not expose the dashboard without authentication.
-   Do not put notification tokens or passwords in Git.
-   Do not add a public firewall rule for the monitoring dashboard.

Acceptance criteria:

-   Uptime Kuma survives container recreation and host reboot with its
    configuration intact.
-   Both monitors report UP when the application is healthy.
-   Stopping the API causes the API monitor to report DOWN within the
    configured detection window.
-   Restarting the API returns the monitor to UP.
-   At least one notification is received and documented.

### 10.2 --- Container and application logging

**Objective:** Build a repeatable log investigation workflow.

Requirements:

-   Inspect logs for `proxy`, `web`, `api`, `db`, and `uptime-kuma`.
-   Practice `docker compose logs`, `--follow`, `--tail`, and
    timestamps.
-   Identify the location and format of Nginx access and error logs in
    the running container.
-   Verify that application errors are visible in API logs.
-   Configure bounded Docker log storage using a suitable logging driver
    and rotation settings.
-   Apply logging configuration consistently to relevant Compose
    services.
-   Document how to inspect logs during a 404, 502, and 504 incident.

Constraints:

-   Avoid logging passwords, JWTs, authorization headers, database
    credentials, or other secrets.
-   Avoid logging full request bodies by default.
-   Do not enable verbose/debug logging permanently in production.
-   Confirm the chosen logging driver is compatible with the commands
    used for log inspection.

Acceptance criteria:

-   The operator can retrieve recent logs for each service.
-   Logs include useful timestamps.
-   A controlled API failure can be diagnosed from logs.
-   Log growth is bounded by documented rotation settings.
-   No credentials or tokens are exposed in the captured evidence.

### 10.3 --- Host and container resource monitoring

**Objective:** Diagnose resource-related service degradation.

Required tools and commands:

-   `uptime`
-   `top` or `htop`
-   `free -h`
-   `df -h`
-   `du`
-   `docker stats`
-   `docker system df`
-   `journalctl`
-   `dmesg` where available and appropriate

Requirements:

-   Record a healthy baseline for CPU, memory, disk, and container
    usage.
-   Identify Docker's storage locations and inspect their disk
    consumption.
-   Identify the largest relevant directories without deleting files.
-   Document how to identify memory pressure, disk pressure, and a
    high-CPU process.
-   Explain the difference between host resource usage and per-container
    resource usage.

Acceptance criteria:

-   The operator can capture host and container resource snapshots.
-   The operator can identify which filesystem is approaching capacity.
-   No cleanup command is run without first inspecting what it will
    remove.
-   A short resource baseline is included in the milestone report.

### 10.4 --- PostgreSQL backup automation

**Objective:** Create reliable, repeatable database backups.

Requirements:

-   Use PostgreSQL's native `pg_dump` tooling.
-   Use a consistent custom-format backup (`-Fc`) unless a documented
    technical reason requires otherwise.
-   Create timestamped backup files.
-   Store backups outside the PostgreSQL data directory and outside the
    database container's writable layer.
-   Use a host directory with restrictive permissions.
-   Run backups through a script that returns a non-zero exit code on
    failure.
-   Validate backup files using `pg_restore --list`.
-   Log backup start, completion, duration, and result without printing
    credentials.
-   Schedule backups with cron or an equivalent host scheduler.
-   Define and implement a configurable retention policy.
-   Document disk-space requirements and backup storage limitations.

Security and reliability requirements:

-   Do not commit database credentials or backup secrets.
-   Do not put secrets directly in command-line arguments where they may
    be exposed in process listings.
-   Prefer a protected environment file or PostgreSQL password file with
    strict ownership and permissions, after inspecting the current
    deployment's credential handling.
-   Do not store backups inside the PostgreSQL data directory.
-   A backup on the same VM is not an off-site backup. Document this
    limitation.
-   Do not delete the only known-good backup during retention testing.

Acceptance criteria:

-   A manual backup completes successfully.
-   The backup can be listed with `pg_restore --list`.
-   A scheduled backup runs and leaves an auditable result.
-   Retention removes only files matching the intended backup naming
    pattern and age threshold.
-   The backup script safely handles failure and partial output.

### 10.5 --- Restore and disaster-recovery validation

**Objective:** Prove that a backup is usable.

Requirements:

-   Restore into a separate temporary database or isolated PostgreSQL
    instance.
-   Never test restoration by overwriting the live production database.
-   Validate schema, row counts, and representative application data.
-   Verify key relationships and application behavior against the
    restored target where practical.
-   Record the backup selected, restore command, validation queries,
    duration, and outcome.
-   Document the recovery procedure for a new VM or a recreated database
    service.

Acceptance criteria:

-   At least one backup is restored successfully to an isolated target.
-   Recovered records match the expected source data for selected
    validation checks.
-   The live production database remains unchanged.
-   A repeatable restore runbook is committed.

### 10.6 --- Application rollback and configuration recovery

**Objective:** Recover from a faulty application release or
configuration change.

Requirements:

-   Inspect the current GitHub Container Registry image naming and
    tagging strategy.
-   Identify the currently deployed image digest or immutable tag.
-   Document how to deploy a previously known-good image.
-   Avoid relying solely on the mutable `latest` tag for rollback.
-   Back up configuration files before changing them.
-   Validate Compose configuration before applying changes.
-   Document safe service restart and Nginx configuration validation
    commands.
-   Define a post-rollback smoke-test checklist.

Acceptance criteria:

-   The operator can identify a previous known-good image.
-   A controlled rollback can be performed without changing database
    contents.
-   The public homepage and `/api/health` pass smoke tests after
    rollback.
-   The rollback procedure includes a clear recovery path if the
    rollback itself fails.

### 10.7 --- Controlled incident simulations

**Objective:** Demonstrate operational competence through repeatable
experiments.

Required experiments:

1.  Stop the API container and observe Uptime Kuma, Nginx, and API logs.
2.  Stop the web container and observe frontend availability behavior.
3.  Stop the database in a controlled maintenance window and investigate
    API symptoms.
4.  Introduce an invalid database credential in an isolated test
    configuration, not by corrupting the live production environment.
5.  Simulate disk pressure using a bounded test file with a predefined
    maximum size and cleanup plan; do not fill the production
    filesystem.
6.  Deploy or run a deliberately invalid application image in a
    controlled manner and demonstrate rollback.
7.  Restore a PostgreSQL backup into an isolated target.

For each experiment record:

-   Experiment ID and objective.
-   Preconditions and safety checks.
-   Exact action performed.
-   Expected result.
-   Actual result and evidence.
-   Detection method.
-   Diagnostic steps.
-   Recovery action.
-   Time to detect and time to recover, where measurable.
-   Prevention or follow-up action.

Acceptance criteria:

-   All required experiments are completed safely.
-   Evidence is captured without exposing secrets.
-   Each experiment has a clear result and recovery record.
-   No experiment causes unrecoverable production data loss.

## 6. Target architecture

The existing production services remain in place. Uptime Kuma is added
as an internal management service.

``` text
                         Internet
                            |
                    luffydev.duckdns.org
                            |
                       OCI Firewall
                         80 / 443
                            |
                     Nginx Reverse Proxy
                       /           \
                      /             \
                 React Web        Express API
                                      |
                                  PostgreSQL

                    Internal Docker Network
                            |
                       Uptime Kuma
                            |
                Persistent monitoring volume

OCI Ubuntu Host
  |
  +-- Docker / Compose logs
  +-- Host CPU, memory, disk and network inspection
  +-- PostgreSQL backup scripts
  +-- Scheduled backup job
  +-- Restricted backup directory
  +-- Incident and recovery runbooks
```

Uptime Kuma's management interface must not become a new public
unauthenticated endpoint. A loopback-only host binding with SSH port
forwarding is the default implementation approach.

## 7. Repository and file organization

Inspect the repository before creating files. Adapt names to the
existing structure rather than duplicating existing conventions.

Suggested organization:

``` text
devops-blog/
├── compose.yaml
├── nginx/
│   └── default.conf
├── scripts/
│   ├── backup-postgres.sh
│   ├── verify-postgres-backup.sh
│   └── restore-postgres-backup.sh
├── docs/
│   └── operations/
│       ├── MILESTONE-10.md
│       ├── MONITORING.md
│       ├── LOGGING.md
│       ├── BACKUP-AND-RESTORE.md
│       ├── ROLLBACK.md
│       └── INCIDENT-REPORTS/
└── .gitignore
```

Do not create empty placeholder files merely to match this tree. Create
files when their corresponding implementation phase is reached.

## 8. Configuration and secrets

-   Reuse the existing `.env` and deployment secret-handling conventions
    after inspection.
-   Add only the environment variables required by the new service or
    scripts.
-   Keep actual secrets out of source control, screenshots, logs, and
    documentation.
-   Add safe example variables to `.env.example` only when appropriate.
-   Ensure backup directories and secret files have restrictive
    permissions.
-   Never print secret values during validation.

## 9. Operational safety rules

These rules are mandatory throughout the milestone:

1.  Do not run destructive commands against production without an
    explicit, reviewed plan.
2.  Never delete or recreate the production PostgreSQL volume as a test.
3.  Never restore a test backup over the live production database.
4.  Never expose PostgreSQL, API, web, or Uptime Kuma management ports
    publicly.
5.  Never commit `.env`, private keys, database passwords, JWT secrets,
    notification tokens, or backup credentials.
6.  Inspect Docker volumes and disk usage before cleanup.
7.  Use immutable image references for rollback where available.
8.  Validate Compose configuration before applying changes.
9.  Preserve existing HTTPS, routing, firewall, and container-isolation
    behavior from Milestone 9.
10. Capture evidence with secrets redacted.

## 10. Verification commands

Commands must be adapted to the actual deployment and run in the correct
directory.

``` bash
# Validate Compose configuration
docker compose config --quiet

# Check service state
docker compose ps

# Follow logs
docker compose logs --follow --tail=100 api

# Inspect resource consumption
docker stats --no-stream

# Inspect Docker storage
docker system df

# Inspect host resources
uptime
free -h
df -h

# Check public application
curl -fsS https://luffydev.duckdns.org/ >/dev/null

# Check public API health
curl -fsS https://luffydev.duckdns.org/api/health

# Inspect a PostgreSQL custom-format backup
pg_restore --list /path/to/backup.dump
```

Never copy a placeholder backup path into a production command without
replacing it with the verified path.

## 11. Documentation deliverables

The final `MILESTONE-10.md` must include:

-   Objective and scope.
-   Before-and-after architecture.
-   Host and service inventory.
-   Monitoring configuration and monitor results.
-   Notification test evidence.
-   Logging configuration and sample redacted investigations.
-   Resource baseline.
-   Backup schedule and retention policy.
-   Backup verification output.
-   Restore procedure and validation evidence.
-   Rollback procedure and smoke-test results.
-   Incident experiment reports.
-   Known limitations and future improvements.

Do not include credentials, tokens, private keys, or unredacted
sensitive logs.

## 12. Definition of Done

Milestone 10 is complete only when all of the following are true:

-   [ ] Uptime Kuma is deployed persistently and is not publicly exposed
    without authentication.
-   [ ] Public homepage and API health are monitored.
-   [ ] DOWN and UP transitions are verified.
-   [ ] A notification is received successfully.
-   [ ] Container and Nginx log investigation procedures are documented.
-   [ ] Docker log rotation is configured and verified.
-   [ ] Host and container resource inspection is documented.
-   [ ] PostgreSQL backups run automatically.
-   [ ] Backup retention is implemented and tested safely.
-   [ ] Backup integrity is checked.
-   [ ] A backup is restored into an isolated target.
-   [ ] Restored data is validated.
-   [ ] Application rollback is documented and tested.
-   [ ] Required incident simulations are completed.
-   [ ] `MILESTONE-10.md` contains reproducible evidence.
-   [ ] Milestone 9 public HTTPS routing and application behavior remain
    healthy.

## 13. Suggested implementation order

Implement in this order and do not skip verification gates:

1.  10.1 --- Availability monitoring.
2.  10.2 --- Logging and log rotation.
3.  10.3 --- Host and container resource inspection.
4.  10.4 --- PostgreSQL backup automation.
5.  10.5 --- Isolated restore and disaster recovery.
6.  10.6 --- Image rollback and configuration recovery.
7.  10.7 --- Controlled incident simulations and final documentation.

Each phase must be reviewed and verified before moving to the next.

------------------------------------------------------------------------

**Milestone principle:** A production system is not reliable merely
because it is running. It is reliable when failures can be detected,
diagnosed, recovered from, and prevented through repeatable operational
procedures.
