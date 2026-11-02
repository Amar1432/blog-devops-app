# PostgreSQL Backup and Disaster Recovery Runbook

This runbook documents the automated backup architecture, retention policies, cryptographic verification, cron scheduling, and recovery procedures for the PostgreSQL database in the `devops-blog` production platform.

---

## 1. Backup Architecture & Security Model

```text
 +---------------------------------------------------------------+
 | OCI Ubuntu Host (/opt/devops-blog)                            |
 |                                                               |
 |  Cron Scheduler (devopsadmin)                                 |
 |        |                                                      |
 |        v                                                      |
 |  [scripts/backup-postgres.sh]                                 |
 |        |                                                      |
 |        |-- (1) docker compose exec -T db                      |
 |        |       pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc  |
 |        |                                                      |
 |        v                                                      |
 |  [Target: /opt/devops-blog/backups/]                          |
 |  - Perms: 0700 (drwx------ devopsadmin:devopsadmin)           |
 |  - Atomic Write: devops_blog_backup_TIMESTAMP.dump.tmp        |
 |        |                                                      |
 |        |-- (2) Integrity Check (pg_restore --list < tmp)      |
 |        |       Pass -> rename to .dump (mode 0600)            |
 |        |       Fail -> trap deletes tmp file                  |
 |        |                                                      |
 |        |-- (3) Generate SHA-256 Checksum (.dump.sha256)       |
 |        |                                                      |
 |        \-- (4) Enforce Retention (Prune matching > 7 days)    |
 +---------------------------------------------------------------+
```

### Core Reliability & Security Invariants:
1. **PostgreSQL Custom Format (`-Fc`)**:
   - Compresses database contents using gzip by default.
   - Provides a structured Table of Contents (TOC) enabling `pg_restore` verification and selective table recovery.
2. **Zero Credential Exposure**:
   - `pg_dump` runs inside the container execution context where `POSTGRES_USER` and `POSTGRES_DB` are already injected from protected `.env` (mode `0600`).
   - No passwords or connection strings are passed in command-line arguments (preventing exposure in `ps aux` or shell histories).
3. **Atomic File Creation & Partial File Prevention**:
   - Backups stream first to a temporary file (`.dump.tmp`).
   - An exit trap immediately removes the `.tmp` file if `pg_dump` fails or is interrupted.
   - The file is promoted to `.dump` **only** after `pg_restore --list` confirms TOC validity.
4. **Restrictive Permissions**:
   - The backup directory `/opt/devops-blog/backups` is restricted to `0700` (`drwx------`).
   - Backup files and checksums are restricted to `0600` (`-rw-------`), preventing unauthorized local read access.
5. **Cryptographic Checksums**:
   - Every backup generates a companion `.dump.sha256` checksum file, allowing instant detection of bit-rot or file corruption.

---

## 2. Manual Backup Execution

Run manually on the server as `devopsadmin`:

### 1. Dry-Run Mode (Preview Only)
```bash
/opt/devops-blog/scripts/backup-postgres.sh --dry-run
```
*Outputs what files would be written and which expired backups would be pruned without changing disk state.*

### 2. Live Backup Execution
```bash
/opt/devops-blog/scripts/backup-postgres.sh
```

**Expected output:**
```text
=================================================================
   PostgreSQL Automated Backup — 2026-11-02 19:32:59 UTC
=================================================================
Compose Spec:   /opt/devops-blog/compose.yaml
Destination:    /opt/devops-blog/backups
Target File:    devops_blog_backup_20261102_193259Z.dump
Retention Cap:  7 days

[1/3] Streaming pg_dump (-Fc custom format) from container...
[2/3] Verifying backup integrity via pg_restore --list...
[SUCCESS] Backup verified and stored: /opt/devops-blog/backups/devops_blog_backup_20261102_193259Z.dump (6.7K)

[3/3] Applying backup retention policy (7 days)...
No obsolete backup files found exceeding 7 days.

=================================================================
Backup process completed in 4s.
=================================================================
```

---

## 3. Backup Verification (`verify-postgres-backup.sh`)

To verify any existing backup file:

```bash
/opt/devops-blog/scripts/verify-postgres-backup.sh /opt/devops-blog/backups/devops_blog_backup_20261102_193259Z.dump
```

**Verification Steps Performed:**
1. **SHA-256 Validation**: Recomputes checksum and matches against `.dump.sha256`.
2. **Magic Header Check**: Validates the first 5 bytes equal `PGDMP`.
3. **TOC Inspection**: Invokes `pg_restore --list` to inspect schemas, tables (`Post`, `User`, `_prisma_migrations`), constraints, and indexes.

---

## 4. Automated Backup Scheduling via Cron

The backup job is scheduled via `cron` under the non-root administrative account `devopsadmin` (member of the `docker` group).

### Step 1: Open User Crontab
```bash
crontab -e
```

### Step 2: Add Scheduled Job
```cron
# DevOps Blog: Automated Daily PostgreSQL Backup at 02:00 UTC
# Backups are stored in /opt/devops-blog/backups with 7-day retention
0 2 * * * /opt/devops-blog/scripts/backup-postgres.sh >> /opt/devops-blog/backups/backup.log 2>&1
```

### Inspecting Backup Logs & Failure Signals
```bash
# View recent cron backup runs
tail -n 50 /opt/devops-blog/backups/backup.log

# Check for failure signals
grep -i "error" /opt/devops-blog/backups/backup.log
```

---

## 5. Retention Policy Mechanics

The retention engine in `backup-postgres.sh`:
- Operates strictly on files matching the exact regex `devops_blog_backup_*.dump` and companion `.dump.sha256`.
- Ignores other files, directories, or manual restore targets.
- Uses `find -mtime +7` to prune files older than `RETENTION_DAYS` (default 7 days).
- Can be overridden at runtime:
  ```bash
  RETENTION_DAYS=14 /opt/devops-blog/scripts/backup-postgres.sh
  ```

---

## 7. Disaster Recovery & Isolated Restoration Drill

> [!IMPORTANT]
> **Safety Invariant**: Under normal operational testing, **NEVER** restore into the live production database. Use the isolated drill script.

### Automated Isolated Drill (`scripts/restore-postgres-backup.sh`)
```bash
/opt/devops-blog/scripts/restore-postgres-backup.sh /opt/devops-blog/backups/devops_blog_backup_20261102_193259Z.dump
```

**What the Drill Executes Behind the Hood:**
1. **Verifies Checksum and Magic Bytes**: Runs SHA-256 validation and confirms `PGDMP` header.
2. **Provisions Ephemeral Target**: Starts an isolated `postgres:16-alpine` container (`devops-blog-restore-drill-<pid>`) with a fresh ephemeral volume, random database name (`devops_blog_restore`), and random user (`restore_test_user`).
3. **Restores Data**: Streams the backup via `pg_restore --no-owner --no-acl`.
4. **Validates Data**: Runs SQL queries asserting that `User` count (1), `Post` count (3), and `_prisma_migrations` count (1) match production source values.
5. **Verifies Production Unchanged**: Queries the live database to confirm that live record counts remain untouched.
6. **Automatic Cleanup**: An `EXIT` trap safely stops and removes the ephemeral container and volume.

---

## 8. Cold-Metal Disaster Recovery Runbook (New Host or Database Rebuild)

If the production VM is lost or the database service must be completely rebuilt from scratch:

### Step 1: Prepare Server & Base Repository
1. Provision fresh Ubuntu VM on OCI with public IPv4 assigned.
2. Install Docker, Docker Compose, and configure `devopsadmin` user with `docker` group membership.
3. Clone repository into `/opt/devops-blog` and checkout `main`.
4. Restore protected `/opt/devops-blog/.env` configuration file (`chmod 0600 .env`).

### Step 2: Transfer Latest Known-Good Backup Artifact
Copy the latest `.dump` and `.dump.sha256` files from off-site storage to `/opt/devops-blog/backups/`:
```bash
mkdir -p /opt/devops-blog/backups
chmod 0700 /opt/devops-blog/backups
# Verify checksum
/opt/devops-blog/scripts/verify-postgres-backup.sh /opt/devops-blog/backups/latest.dump
```

### Step 3: Boot PostgreSQL Database Service Only
```bash
cd /opt/devops-blog
docker compose -f deploy/compose.yaml up -d db
# Wait until database reports healthy
docker compose -f deploy/compose.yaml ps db
```

### Step 4: Restore Backup into Fresh Production Database
```bash
docker compose -f deploy/compose.yaml exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < /opt/devops-blog/backups/latest.dump
```

### Step 5: Start Full Production Stack
```bash
docker compose -f deploy/compose.yaml up -d
docker compose -f deploy/compose.yaml ps
```

### Step 6: Execute Post-Recovery Smoke Tests
```bash
# 1. Check API health endpoint
curl -fsS https://luffydev.duckdns.org/api/health

# 2. Check public posts endpoint
curl -fsS https://luffydev.duckdns.org/api/posts | grep -q "First Production Post"

# 3. Check public frontend
curl -fsS https://luffydev.duckdns.org/ >/dev/null
```

---

## 9. Measured Recovery Metrics (Evidence Baseline)

Based on live operational measurements taken during Phase 10.5 testing:
- **Measured Database Restore Time**: **1 second** (`pg_restore` execution).
- **Measured Full Drill Duration**: **16 seconds** (container spin up, database initialization, restore, verification queries, container teardown).
- **Estimated Full Host Recovery Time Objective (RTO)**: **< 15 minutes** (VM provisioning, image pulls, and restore).
- **Recovery Point Objective (RPO)**: **24 hours** with daily scheduled cron backups (can be reduced to 6 hours or 1 hour by adjusting cron schedule).

