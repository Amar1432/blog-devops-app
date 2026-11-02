# Incident Report: INC-07 — PostgreSQL Backup Restore into Isolated Target

- **Incident ID**: INC-07
- **Title**: Isolated Disaster Recovery Drill & Database Restoration
- **Environment**: Isolated Ephemeral Docker Container on OCI Ubuntu VM
- **Date / Time**: 2026-11-02 19:40:39 UTC
- **Severity**: Routine Operational DR Validation

---

## 1. Objective
Prove that PostgreSQL custom-format backups can recover the application database into an isolated target with full integrity without endangering the live production database.

## 2. Preconditions & Safety Checks
- Safety check: Never restore into live database `devops_blog_prod`.
- Target: Ephemeral container `devops-blog-restore-drill-78249` with its own isolated memory and anonymous volume.

## 3. Exact Action
```bash
/opt/devops-blog/scripts/restore-postgres-backup.sh /opt/devops-blog/backups/devops_blog_backup_20261102_193259Z.dump
```

## 4. Observed Behavior
- Backup verification passed: SHA-256 confirmed `[OK]`, `PGDMP` header confirmed `[OK]`.
- Ephemeral PostgreSQL 16 container booted and reached permanent daemon readiness.
- Restore completed via `pg_restore` in **1 second**.
- Recovered schema and tables:
  ```text
  public | Post               | table | restore_test_user
  public | User               | table | restore_test_user
  public | _prisma_migrations | table | restore_test_user
  ```
- Recovered record counts:
  - `User`: **1** (`admin@devopsblog.local`)
  - `Post`: **3** (`First Production Post`, `Rise of the AI 🤖`, `Milestone 9: HTTPS & Reverse Proxy Secured 🚀`)
  - `_prisma_migrations`: **1**
- Live production database Post count confirmed at **3** (unmodified).
- Ephemeral container dismantled automatically on script exit.

## 5. Metrics
- **Restore Duration**: 1 second.
- **Full Drill Duration**: 16 seconds.
- **RTO (Recovery Time Objective)**: < 15 minutes for fresh host recovery.
- **RPO (Recovery Point Objective)**: 24 hours (scheduled daily cron).

## 6. Final Status
VERIFIED & COMPLETED.
