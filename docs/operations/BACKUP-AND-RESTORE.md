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

## 6. Disaster Recovery Limitation: Same-Host Storage

> [!WARNING]
> **Critical Infrastructure Caveat**:
> Backups stored on `/opt/devops-blog/backups/` reside on the same NVMe drive (`/dev/sda1`) as the running database container.
> 
> **What same-host backups protect against:**
> - Accidental data deletion or table truncation.
> - Bad application schema migrations.
> - PostgreSQL database volume corruption.
> 
> **What same-host backups DO NOT protect against:**
> - Loss or termination of the OCI VM instance.
> - Underlying host hardware / block volume failure.
> - Tenancy or credential compromise.
> 
> **Recommended Off-Site Replication:**
> Replicate the `/opt/devops-blog/backups` directory off-host using `rclone` or `oci-cli` to OCI Object Storage or AWS S3 on a daily schedule.
