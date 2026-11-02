# Milestone 10 --- Implementation Prompts

This document contains sequential coding-agent prompts for implementing
Milestone 10 of `devops-blog`.

## How to use these prompts

1.  Open the `devops-blog` repository in your coding agent.
2.  Give the agent the Milestone 10 specification and the prompt for the
    current phase.
3.  Ask it to inspect the repository and current deployment conventions
    before editing.
4.  Review the proposed plan before allowing infrastructure or
    production changes.
5.  Implement one phase at a time.
6.  Run the verification steps and inspect the evidence yourself.
7.  Update the milestone documentation before moving to the next phase.

**Important:** These prompts authorize repository changes and
preparation of commands. They do not authorize the agent to connect to
production, execute destructive commands, reveal secrets, or make
unreviewed infrastructure changes. Any production command must be
presented for your explicit review and execution.

------------------------------------------------------------------------

# Prompt 0 --- Milestone-wide agent instructions

Use this prompt at the beginning of the milestone. Keep it in context
for every phase.

``` text
You are a Senior DevOps Engineer and Infrastructure Reliability Engineer working on my devops-blog project.

Your task is to implement Milestone 10 according to the supplied MILESTONE-10-SPEC.md.

PROJECT CONTEXT
- Production host: Oracle Cloud Infrastructure Ubuntu VM.
- Deployment: Docker Compose.
- Public application: https://luffydev.duckdns.org
- Existing services: Nginx reverse proxy, React web container, Node.js/Express API container, PostgreSQL 16 container, Certbot.
- Existing public ports: 80 and 443 only for application traffic; SSH is used for administration.
- Internal services communicate over the existing Docker bridge network.
- API health endpoint: /api/health.
- PostgreSQL data is stored in a named Docker volume.
- Milestone 9 implemented DNS, HTTPS, Nginx reverse proxy, container isolation, firewall hardening, certificate renewal, and reboot recovery.

MANDATORY FIRST STEP
Before editing anything:
1. Inspect the repository tree.
2. Read compose.yaml, Nginx configuration, Dockerfiles, scripts, .env.example, .gitignore, and existing operational documentation where present.
3. Inspect the existing image tagging and GitHub Actions workflow.
4. Identify the actual Compose project, service names, volume names, network names, and environment variable conventions.
5. Compare the repository state with the supplied Milestone 9 documentation.
6. Report mismatches and assumptions.
7. Propose a small implementation plan and list every file you intend to change.

ENGINEERING RULES
- Follow the supplied Milestone 10 specification as the source of truth.
- Preserve the existing production architecture unless a change is explicitly required.
- Do not casually refactor unrelated application code.
- Do not invent service names, paths, credentials, image tags, or environment variables.
- Prefer small, reviewable changes.
- Keep secrets out of Git, command output, logs, and documentation.
- Update .env.example with safe placeholders only when required.
- Add appropriate comments for operationally sensitive configuration.
- Use shell scripts with strict error handling where appropriate.
- Make scripts idempotent where practical.
- Quote shell variables and handle paths safely.
- Do not silently ignore command failures.
- Explain commands that require elevated privileges.
- Do not assume a tool exists on the production host; verify or document installation requirements.
- Validate YAML, shell syntax, Compose configuration, and relevant scripts.
- Never claim a test passed unless it was actually run and its result inspected.

PRODUCTION SAFETY
- Do not connect to or modify the production server unless I explicitly request it.
- Do not run destructive commands.
- Never remove, prune, recreate, or overwrite the production PostgreSQL volume.
- Never restore a backup over the production database during testing.
- Never fill the production disk to simulate disk pressure.
- Never expose PostgreSQL, API, web, or monitoring management ports publicly.
- Do not add public firewall rules for internal services.
- Do not print secrets or ask me to paste secrets into source files.
- For production operations, provide exact commands, explain their impact, and wait for my approval before execution.
- Use an isolated test database or test environment for destructive experiments.

WORKFLOW
For each phase:
1. Inspect relevant files and runtime assumptions.
2. Explain the design briefly.
3. Present the planned file changes.
4. Implement only the current phase.
5. Run local/static validation.
6. Provide commands for me to execute on the server.
7. Explain expected output and failure interpretation.
8. Update the relevant documentation.
9. Report completed work, unverified items, risks, and the next phase.

OUTPUT FORMAT
- Current phase objective
- Existing-state findings
- Architecture/design
- Files to create or modify
- Implementation
- Validation performed
- Production commands for operator review
- Acceptance criteria checklist
- Risks and rollback
- Documentation updates
- Next phase

Do not start the next phase automatically. Stop and wait for my review after completing the current phase.
```

------------------------------------------------------------------------

# Prompt 10.1 --- Deploy Uptime Kuma and configure availability monitoring

``` text
Implement Milestone 10.1: Availability Monitoring with Uptime Kuma.

Read MILESTONE-10-SPEC.md and follow the milestone-wide agent instructions.

OBJECTIVE
Deploy Uptime Kuma as a persistent monitoring service alongside the existing devops-blog Docker Compose stack. Configure monitoring for the public frontend and API health endpoint.

TASKS
1. Inspect the current Compose file, network, volume naming, service dependencies, and restart policies.
2. Select a stable Uptime Kuma image tag rather than blindly using an unpinned latest tag.
3. Add an uptime-kuma service to Compose.
4. Attach it to the appropriate Docker network only if needed.
5. Add a named persistent volume for Uptime Kuma application data.
6. Configure restart behavior.
7. Do not expose the management port publicly.
8. Prefer a host binding to 127.0.0.1 and document SSH port forwarding:
   ssh -L 3001:127.0.0.1:3001 <server-user>@<server-host>
9. Document how to access the dashboard locally through http://127.0.0.1:3001.
10. Ensure no OCI or UFW public ingress rule is needed for port 3001.
11. Document initial admin account setup and secure credential handling.
12. Configure two monitors:
    - https://luffydev.duckdns.org/
    - https://luffydev.duckdns.org/api/health
13. Configure a notification provider using secrets entered through the Uptime Kuma UI or a protected secret mechanism. Never commit notification credentials.
14. Document the detection interval, retry count, and expected detection window.
15. Document how to test DOWN and UP transitions by stopping and starting only the API service.

SECURITY
- No public 3001 port.
- No unauthenticated monitoring dashboard.
- No secrets in Compose literals, Git, logs, or screenshots.
- Do not alter existing Nginx routes or TLS configuration unless a reviewed design requires it.
- Do not expose internal services.

VALIDATION
- Run docker compose config --quiet.
- Validate the service and volume configuration.
- Explain the operator commands to start the new service.
- Provide commands to verify the loopback-only port binding.
- Provide a safe API stop/start test procedure.
- Verify that Uptime Kuma data persists after container recreation.
- Do not claim live monitoring or notification delivery unless I provide the observed results.

DELIVERABLES
- Compose changes.
- Any required .env.example or .gitignore changes.
- docs/operations/MONITORING.md.
- Update docs/operations/MILESTONE-10.md with 10.1 status and evidence placeholders only where evidence is not yet available.

Stop after 10.1. Report exact files changed and wait for my review.
```

------------------------------------------------------------------------

# Prompt 10.2 --- Logging, troubleshooting, and log rotation

``` text
Implement Milestone 10.2: Container and Application Logging.

Read the milestone specification and inspect the current Compose configuration and application logging implementation.

OBJECTIVE
Establish a safe and repeatable way to inspect production logs while preventing unbounded Docker log growth.

TASKS
1. Inventory logging behavior for proxy, web, api, db, certbot, and uptime-kuma.
2. Inspect the Docker logging driver currently in use.
3. Confirm that docker compose logs works with the selected driver.
4. Document useful commands:
   - docker compose logs --tail=100 <service>
   - docker compose logs --follow <service>
   - docker compose logs --timestamps <service>
   - docker compose logs --since=30m <service>
5. Inspect Nginx access and error log behavior inside the proxy container.
6. Inspect API logging implementation and error handling.
7. Determine whether the application logs useful request context and error stack information without logging sensitive data.
8. Add bounded Docker logging configuration using appropriate max-size and max-file values.
9. Apply consistent logging options to relevant services.
10. Explain whether any service needs a different logging configuration.
11. Add troubleshooting guidance for 404, 502, and 504 responses.
12. Document how to correlate a request across Nginx and API logs where request identifiers are available.

SECURITY
- Never log passwords, JWTs, cookies, authorization headers, database URLs, or secrets.
- Do not log full request bodies by default.
- Do not leave production debug logging enabled.
- Do not change the Docker daemon-wide logging driver unless there is a compelling documented reason and explicit operator approval.
- Avoid logging configuration that makes existing logs inaccessible.

VALIDATION
- Validate Compose configuration.
- Validate application tests if application logging code changes.
- Explain whether a container recreation is required for logging options to take effect.
- Provide a safe procedure to generate a test request and inspect corresponding logs.
- Explain how to verify log rotation behavior without generating excessive logs.

DELIVERABLES
- Compose logging configuration.
- Application logging changes only if justified.
- docs/operations/LOGGING.md.
- Update milestone evidence and acceptance criteria.

Stop after 10.2 and wait for review.
```

------------------------------------------------------------------------

# Prompt 10.3 --- Host and container resource monitoring

``` text
Implement Milestone 10.3: Host and Container Resource Monitoring.

OBJECTIVE
Create a practical resource-inspection runbook for the OCI Ubuntu VM and Docker containers. Do not introduce a large monitoring stack in this phase.

TASKS
1. Document host checks using uptime, top/htop, free -h, df -h, du, journalctl, and dmesg where available.
2. Document Docker checks using docker stats --no-stream, docker system df, docker ps, and docker inspect.
3. Explain the difference between host-level and container-level CPU/memory reporting.
4. Identify the Docker data-root location using Docker inspection rather than assuming a path.
5. Document how to identify large Docker images, containers, volumes, and log files.
6. Create a resource baseline template with timestamp, CPU, memory, disk, and container observations.
7. Define warning thresholds as initial operational guidelines, not universal truths.
8. Explain safe disk investigation and cleanup practices.
9. Do not automatically delete images, volumes, logs, or backups.
10. If a small script is useful, make it read-only and safe to execute repeatedly.

SAFETY
- Never run docker system prune -a or volume prune as part of this task.
- Never delete PostgreSQL or Certbot volumes.
- Never create uncontrolled disk or memory pressure.
- Do not install a metrics stack unless the specification is explicitly amended.

VALIDATION
- Validate scripts with shellcheck if available and bash -n.
- Provide sample commands and explain what healthy and unhealthy output may look like.
- Capture a baseline only if actual host access is explicitly provided; otherwise create a template and operator instructions.

DELIVERABLES
- docs/operations/RESOURCE-MONITORING.md.
- Optional read-only inspection script if it adds clear value.
- Updated milestone report.

Stop after 10.3 and wait for review.
```

------------------------------------------------------------------------

# Prompt 10.4 --- PostgreSQL backup automation

``` text
Implement Milestone 10.4: PostgreSQL Backup Automation.

OBJECTIVE
Create a reliable, secure, timestamped PostgreSQL backup workflow for the existing Docker Compose deployment.

FIRST INSPECT
- Actual Compose project and database service name.
- PostgreSQL version and database name.
- Existing environment variable and secret handling.
- Host deployment directory and operator account.
- Available disk space and existing backup directories, if server information is provided.
- Whether a backup strategy already exists.

IMPLEMENTATION
1. Create scripts/backup-postgres.sh.
2. Use pg_dump custom format (-Fc).
3. Invoke pg_dump through the existing database container or a compatible PostgreSQL client.
4. Create timestamped backup filenames.
5. Store backups in a host directory outside the PostgreSQL data directory and container writable layer.
6. Ensure restrictive directory and file permissions.
7. Use strict shell error handling.
8. Ensure failed backups do not leave a partial file that looks like a valid backup.
9. Record start time, completion time, duration, and status.
10. Validate successful backup output using pg_restore --list.
11. Add configurable retention logic that matches only the intended backup filename pattern.
12. Make retention dry-run or preview behavior available before deletion.
13. Create a protected cron configuration example or installation instructions.
14. Ensure the cron job runs as the intended non-root operator with required Docker permissions.
15. Document how to receive or inspect backup failure signals.
16. Document that same-host backups do not protect against VM loss.

CREDENTIAL HANDLING
- Do not hardcode passwords.
- Do not put passwords in command-line arguments.
- Inspect the existing environment handling before choosing a credential mechanism.
- If a protected environment file or PGPASSFILE is required, document ownership and restrictive permissions.
- Never print credential values.
- Do not commit secrets.

VALIDATION
- bash -n scripts/backup-postgres.sh.
- shellcheck if available.
- Test script logic in a safe local or isolated environment where possible.
- Provide exact manual execution commands for operator review.
- Verify backup integrity using pg_restore --list.
- Demonstrate retention in dry-run mode before any actual deletion.
- Do not execute a production backup or cron installation without explicit operator approval.

DELIVERABLES
- scripts/backup-postgres.sh.
- Optional scripts/verify-postgres-backup.sh.
- Protected cron installation example/documentation.
- docs/operations/BACKUP-AND-RESTORE.md.
- Update milestone report.

Stop after 10.4 and wait for review.
```

------------------------------------------------------------------------

# Prompt 10.5 --- Isolated PostgreSQL restore and disaster recovery

``` text
Implement Milestone 10.5: PostgreSQL Restore and Disaster Recovery.

OBJECTIVE
Prove that the PostgreSQL backups created in 10.4 can recover usable data without modifying the live production database.

MANDATORY SAFETY RULE
Never restore into the live production database. Never drop, recreate, or overwrite the production PostgreSQL volume.

TASKS
1. Inspect the backup format and current database schema.
2. Design an isolated restore target:
   - A temporary database in a controlled PostgreSQL instance, or
   - A separate temporary PostgreSQL container with its own isolated volume and network.
3. Ensure the restore target cannot accidentally resolve to the production database.
4. Document the exact backup selection process.
5. Verify the backup with pg_restore --list.
6. Restore using pg_restore into the isolated target.
7. Capture restore errors and warnings.
8. Validate schema and representative records.
9. Compare selected table row counts and representative records with known source values.
10. Verify important relationships and constraints.
11. Where practical, point a temporary application instance at the restored database and run read-only smoke tests.
12. Document cleanup of the isolated test environment only after evidence is captured.
13. Write a recovery runbook for rebuilding the database service or recovering onto a new VM.

VALIDATION
- Demonstrate a successful isolated restore.
- Demonstrate selected data validation.
- Prove the production database was not modified.
- Record restore duration and any manual steps.
- Do not claim a recovery time objective or recovery point objective without measured evidence.

DELIVERABLES
- scripts/restore-postgres-backup.sh or a documented safe restore procedure.
- docs/operations/BACKUP-AND-RESTORE.md updated with restore steps.
- Restore validation evidence in the milestone report.

Stop after 10.5 and wait for review.
```

------------------------------------------------------------------------

# Prompt 10.6 --- Application rollback and configuration recovery

``` text
Implement Milestone 10.6: Application Rollback and Configuration Recovery.

OBJECTIVE
Create a predictable way to recover from a broken application image or faulty infrastructure configuration.

TASKS
1. Inspect GitHub Actions workflows and GHCR image naming/tagging.
2. Determine whether images are tagged with commit SHA, release version, and/or latest.
3. Identify how to determine the exact image currently deployed.
4. Prefer immutable commit-SHA or digest references for rollback.
5. Document how to select a previous known-good image.
6. Design a rollback method compatible with the current Compose deployment.
7. Avoid changing the database schema or data as part of an application-only rollback.
8. Document configuration backup and recovery before Nginx or Compose changes.
9. Document docker compose config validation.
10. Document Nginx configuration validation using nginx -t in the correct container/context.
11. Document safe service recreation and restart behavior.
12. Create a post-rollback smoke-test checklist:
    - Homepage returns success.
    - API health returns success.
    - API data endpoint works.
    - Login flow works where appropriate.
    - Existing content is intact.
13. Document failure handling if the rollback image is unavailable or rollback fails.

SAFETY
- Do not deploy an unverified image to production.
- Do not change the production deployment automatically.
- Do not use latest as the only rollback reference.
- Do not alter the PostgreSQL volume or perform schema rollback without a separate reviewed database recovery plan.

VALIDATION
- Validate scripts and Compose files.
- If possible, demonstrate rollback in an isolated environment.
- If production validation is needed, provide commands for operator review and wait for approval.
- Do not claim rollback success without observed smoke-test results.

DELIVERABLES
- docs/operations/ROLLBACK.md.
- Optional rollback helper script only if safe and justified.
- Updated milestone report.

Stop after 10.6 and wait for review.
```

------------------------------------------------------------------------

# Prompt 10.7 --- Failure simulations, incident reports, and milestone closure

``` text
Implement Milestone 10.7: Controlled Production Failure Simulations and Final Documentation.

OBJECTIVE
Demonstrate that monitoring, logging, resource inspection, backup, restore, and rollback procedures work together.

FIRST STEP
Review all previous Milestone 10 deliverables. Identify incomplete acceptance criteria and missing evidence. Do not mark a test complete based on documentation alone.

REQUIRED EXPERIMENTS
1. API container stopped.
2. Web container stopped.
3. Database unavailable in a controlled maintenance/test environment.
4. Invalid database credentials in an isolated test configuration.
5. Bounded disk-pressure simulation with a predefined size limit and cleanup plan.
6. Broken image deployment and rollback in an isolated environment where possible.
7. PostgreSQL backup restore into an isolated target.

FOR EACH EXPERIMENT
Create an incident report with:
- ID and title.
- Objective.
- Environment.
- Preconditions.
- Safety checks.
- Exact action.
- Expected behavior.
- Observed behavior.
- Monitoring signal.
- Relevant redacted logs.
- Root cause.
- Recovery action.
- Detection time and recovery time, if measured.
- Prevention or follow-up task.
- Final status.

SAFETY
- Never fill the production disk.
- Never corrupt production credentials.
- Never remove production volumes.
- Never restore over production data.
- Never leave production services stopped.
- Ensure each failure test has a recovery step and cleanup verification.

FINAL DOCUMENTATION
Create or complete docs/operations/MILESTONE-10.md with:
1. Executive summary.
2. Final architecture.
3. Service inventory.
4. Monitoring setup and evidence.
5. Logging and rotation setup.
6. Resource baseline.
7. Backup schedule and retention.
8. Backup integrity evidence.
9. Isolated restore evidence.
10. Rollback runbook.
11. Incident experiment reports.
12. Known limitations.
13. Remaining risks.
14. Definition-of-done checklist.

FINAL REVIEW
- Verify every acceptance criterion against actual evidence.
- Distinguish implemented, locally tested, production verified, and not tested.
- Check for leaked secrets in documentation and changed files.
- Validate Compose and shell scripts.
- Confirm Milestone 9 HTTPS, routing, and public application behavior have not been unintentionally changed.
- Provide a concise final review and list any remaining gaps.

Do not start a new milestone. Stop and present the Milestone 10 completion report for my review.
```

------------------------------------------------------------------------

## Final operator review prompt

Use this after all seven phases are implemented:

``` text
Act as an independent Senior SRE reviewer.

Review the complete Milestone 10 implementation against MILESTONE-10-SPEC.md.

Do not modify files initially.

Inspect:
- Docker Compose changes.
- Uptime Kuma security and persistence.
- Monitor and notification evidence.
- Docker logging and rotation.
- Host/container resource runbooks.
- PostgreSQL backup script.
- Retention safety.
- Backup integrity checks.
- Isolated restore evidence.
- Rollback procedure.
- Incident reports.
- Secret exposure and permissions.
- Milestone 9 regression risks.

For each requirement, classify it as:
1. PASS — evidence demonstrates it works.
2. PARTIAL — implemented but evidence or validation is incomplete.
3. FAIL — missing, incorrect, or unsafe.
4. NOT TESTED — no execution evidence.

Identify critical, high, medium, and low risks.

Check especially for:
- Production database volume risk.
- Publicly exposed internal ports.
- Unbounded logs or backup growth.
- Credentials in scripts or logs.
- Backups stored only on the same VM.
- Restore tests that accidentally target production.
- Rollback depending only on mutable image tags.
- Documentation claiming tests passed without evidence.

Return:
- Executive verdict.
- Requirement-by-requirement scorecard.
- Critical findings.
- Recommended fixes in priority order.
- Exact acceptance criteria still outstanding.

Do not declare Milestone 10 complete if any critical safety issue remains.
```

------------------------------------------------------------------------

## Suggested execution sequence

  Order   Prompt                        Required output
  ------- ----------------------------- --------------------------------
  0       Milestone-wide instructions   Repository assessment and plan
  1       10.1                          Uptime Kuma and monitors
  2       10.2                          Logging and rotation
  3       10.3                          Resource monitoring runbook
  4       10.4                          Automated PostgreSQL backups
  5       10.5                          Isolated restore proof
  6       10.6                          Rollback runbook
  7       10.7                          Incident reports and closure
  8       Final review                  Independent SRE assessment

**Do not ask the coding agent to implement all phases in one run.** The
review gates are intentional: they reduce the risk of infrastructure
changes accumulating before you have verified the previous phase.
