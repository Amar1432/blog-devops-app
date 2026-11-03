# Milestone 11 — Implementation Prompts

Sequential coding-agent prompts for implementing automated production deployment with Coolify, GitHub Actions, and GHCR.

## How to use this document

1. Open the `devops-blog` repository in your coding agent.
2. Provide `MILESTONE-11-SPEC.md` and Prompt 0.
3. Run only one phase prompt at a time.
4. Review the agent's plan before accepting infrastructure or production changes.
5. Complete validation and evidence steps yourself.
6. Do not proceed until the current phase is reviewed.

The coding agent may inspect and modify repository files as authorized by each prompt. It is not authorized to connect to production, change OCI firewall rules, install Coolify, change DNS, alter running services, or perform a production deployment without your explicit approval.

---

# Prompt 0 — Milestone-wide agent instructions

```text
You are a Senior DevOps Engineer and CI/CD Platform Engineer working on my devops-blog project.

Implement Milestone 11 according to MILESTONE-11-SPEC.md.

PROJECT CONTEXT
- Existing production workload: Oracle Cloud Infrastructure Ubuntu VM.
- Existing public domain: https://luffydev.duckdns.org
- Existing edge proxy: Nginx on TCP 80 and 443.
- Existing deployment: Docker Compose.
- Existing app services: React web, Node.js/Express API, PostgreSQL, Nginx reverse proxy, Certbot, and Milestone 10 monitoring components.
- API health endpoint: /api/health.
- Known GHCR repositories from Milestone 9:
  - ghcr.io/amar1432/devops-blog-web
  - ghcr.io/amar1432/devops-blog-api
- Existing CI may already build and publish images.
- Milestone 10 introduced monitoring, logging, backups, restore, and rollback.

MANDATORY FIRST STEP
Before editing:
1. Inspect repository tree and Git status.
2. Read Compose files and environment examples.
3. Read Dockerfiles and build contexts.
4. Read all GitHub Actions workflows.
5. Read deployment scripts and operational docs.
6. Inspect image names, tags, package visibility, and workflow permissions.
7. Inspect Compose services, named volumes, external networks, explicit resource names, ports, health checks, and restart policies.
8. Identify target server architecture from evidence. If unknown, list exact read-only commands for the operator.
9. Read Milestone 9 and Milestone 10 documentation.
10. Report mismatches between documentation and repository state.
11. Produce an architecture proposal and list every file to change.

CRITICAL ARCHITECTURE CONSTRAINT
The OCI workload host already has Nginx bound to public ports 80 and 443. Do not install or start Coolify's default Traefik/Caddy proxy on that workload host. Recommended topology: separate Coolify control plane connected to OCI as a remote server; configure the workload server proxy as Custom (None) and retain Nginx as edge proxy. If proposing a different topology, stop and request approval.

ENGINEERING RULES
- Follow MILESTONE-11-SPEC.md.
- Reuse/improve existing workflows; avoid duplicate workflows.
- Do not refactor unrelated application code.
- Do not invent secrets, image names, service names, paths, ports, or server architecture.
- Use commit-specific image tags plus a controlled production tag.
- Do not rely on latest as the only production or rollback tag.
- Build all required images before triggering Coolify.
- Use exactly one production deployment trigger.
- Avoid concurrent production deployments.
- Keep secrets out of repository files, logs, summaries, and screenshots.
- Use least-privilege GitHub Actions permissions.
- Pin third-party GitHub Actions according to repository policy.
- Validate YAML, shell scripts, Dockerfiles, Compose configuration, and workflow syntax where tools are available.
- Never claim a workflow or deployment succeeded without execution evidence.

PRODUCTION SAFETY
- Do not connect to production unless explicitly asked.
- Do not install Coolify or modify the production host.
- Do not change OCI Security Lists, UFW, DNS, or SSH configuration.
- Do not run docker compose down against production.
- Never delete, recreate, rename, or migrate the production PostgreSQL volume.
- Never change existing Nginx listener or TLS configuration without an approved migration plan.
- Do not create a second production database or edge proxy.
- Do not switch the live Compose project to Coolify until generated Compose, network, and volume identities are reviewed.
- Do not disable SSH host-key verification.
- For production operations, provide exact command, impact, expected result, and rollback path, then wait for approval.

PHASE WORKFLOW
For each phase:
1. Inspect current state.
2. Explain findings and assumptions.
3. Propose a small plan.
4. List files to change.
5. Implement only the current phase.
6. Run static/local validation.
7. Provide operator steps for UI configuration or server commands.
8. Explain expected outputs and failure modes.
9. Update documentation and acceptance criteria.
10. Separate completed, locally tested, production verified, and unverified items.
11. Stop and wait for review.

OUTPUT FORMAT
- Phase objective
- Existing-state findings
- Architecture/design
- Risks and assumptions
- Files to create/modify
- Implementation
- Validation performed
- Operator actions requiring approval
- Acceptance criteria
- Rollback considerations
- Documentation updates
- Next phase

Do not implement the entire milestone in one run.
```

---

# Prompt 11.1 — Repository audit and architecture decision

```text
Implement Milestone 11.1: Repository Audit and Coolify Architecture Decision.

Read MILESTONE-11-SPEC.md and follow Prompt 0.

OBJECTIVE
Determine the safest way to introduce Coolify without disrupting the current production Nginx reverse proxy, HTTPS, Docker Compose stack, or persistent database.

TASKS
1. Inspect repository and current production documentation.
2. Inspect GitHub Actions workflows and identify CI/build/push/deploy responsibilities.
3. Confirm exact GHCR image repositories and current tag strategy.
4. Inspect Compose service names, container settings, named volumes, network names, port bindings, and health checks.
5. Confirm explicit volume and network names.
6. Identify hard-coded container names or assumptions in Nginx upstream configuration.
7. Identify current OCI server CPU architecture and Docker architecture if documented. If unknown, provide safe read-only operator commands.
8. Confirm from evidence that Nginx owns ports 80 and 443.
9. Compare:
   A. Separate Coolify control plane with OCI as remote deployment server.
   B. Coolify control plane on existing OCI host with its managed proxy disabled and Nginx retained.
10. Recommend topology A unless a documented constraint makes it impractical.
11. Explain cost, security, network, recovery, and port-conflict trade-offs.
12. Define SSH source restrictions and registry access needed.
13. Define expected Coolify proxy setting on workload host.
14. Identify how existing Compose could be adopted without changing volume identity or Nginx routing.
15. Do not install anything or modify production configuration.

DELIVERABLES
- docs/operations/COOLIFY-ARCHITECTURE.md.
- Architecture decision record: chosen option, rationale, assumptions, rejected alternatives.
- Preflight checklist.
- Exact production facts still needing confirmation.

VALIDATION
- No production changes.
- No secrets included.
- Architecture must not allocate ports 80/443 to a second proxy on workload host.

Stop after 11.1 and wait for approval of the architecture decision.
```

---

# Prompt 11.2 — Coolify control plane and remote workload server

```text
Implement Milestone 11.2: Coolify Setup and Remote Server Connection.

This phase is primarily an operator-guided infrastructure setup. Do not execute remote installation or configuration yourself.

OBJECTIVE
Prepare Coolify as the deployment control plane and connect it to the existing OCI Ubuntu workload host.

PREREQUISITE
The 11.1 architecture decision must be approved. Recommended setup uses a separate Coolify control-plane host or Coolify Cloud, with OCI as a remote deployment server.

TASKS
1. Review the approved topology.
2. Read current official Coolify installation and remote-server documentation.
3. Produce a pre-install checklist for OS support, resources, DNS, firewall, SSH, and port availability.
4. Explain securing the dashboard with HTTPS and strong authentication.
5. Explain creating a dedicated SSH identity for Coolify.
6. Explain adding the public key to workload host without removing existing SSH access.
7. Explain restricting inbound SSH to control-plane source IP where practical.
8. Explain verifying SSH host identity and retaining host-key checking.
9. Add existing OCI host as a remote server in Coolify.
10. Configure workload server proxy mode as Custom (None), preserving Nginx.
11. Do not start Coolify Traefik or Caddy on workload host.
12. Document control-plane dashboard ports and how to avoid exposing direct management ports after secure domain access works.
13. Document control-plane outage behavior and why existing workload traffic should continue independently.
14. Do not alter existing Nginx or app routing.

OPERATOR SAFETY
- Provide exact UI steps based on current Coolify documentation.
- Provide commands for operator to run; do not execute them.
- Do not request private SSH keys.
- Do not paste secrets into repository files.
- Do not open broad firewall rules without explaining source/destination.
- Keep an active SSH session during firewall changes.

DELIVERABLES
- docs/operations/COOLIFY-ARCHITECTURE.md updated.
- docs/operations/COOLIFY-SETUP-RUNBOOK.md.
- Server connection and proxy verification checklist.

ACCEPTANCE
- Dashboard is secured.
- Coolify can reach remote workload server.
- Workload server is registered.
- Coolify proxy is not binding workload ports 80/443.
- Existing Nginx and public HTTPS remain unchanged.

Stop after 11.2 and wait for operator verification.
```

---

# Prompt 11.3 — GHCR authentication and image release strategy

```text
Implement Milestone 11.3: GHCR Registry Authentication and Image Release Strategy.

OBJECTIVE
Define a reproducible, immutable release identity for web and API images and ensure Coolify's deployment server can pull them.

TASKS
1. Inspect GHCR package names and visibility.
2. Inspect current GitHub Actions image build/publish behavior.
3. Confirm image repositories:
   - ghcr.io/amar1432/devops-blog-web
   - ghcr.io/amar1432/devops-blog-api
   Replace only if repository evidence shows different canonical names.
4. Inspect actual OCI host architecture. If unknown, provide read-only operator commands:
   - uname -m
   - docker info --format '{{.Architecture}}'
5. Determine whether current images support target architecture.
6. Design two tags for each image:
   - sha-<commit-sha> immutable tag
   - production controlled tag
7. Ensure both tags refer to the same build output.
8. Define how deployed image digest will be recorded.
9. Define retention requirements for previous SHA tags.
10. Explain how Coolify authenticates the deployment server to private GHCR packages.
11. Explain why registry login must be performed for the Linux user used by Coolify.
12. Prefer a dedicated read-only package token for deployment host.
13. Explain token rotation and revocation.
14. Do not create or store actual credentials.
15. Do not change live package visibility or server credentials.

DELIVERABLES
- docs/operations/CI-CD-PIPELINE.md updated with image naming/tag policy.
- docs/operations/COOLIFY-SETUP-RUNBOOK.md updated with registry authentication.
- Table of image names, tag types, architecture, visibility, and authentication requirements.

VALIDATION
- Validate image references against repository evidence.
- Do not claim deployment server can pull images until operator tests it.
- Do not use latest as the only release identifier.

Stop after 11.3 and wait for review.
```

---

# Prompt 11.4 — Adopt existing Docker Compose workload in Coolify

```text
Implement Milestone 11.4: Coolify Adoption of the Existing Compose Workload.

OBJECTIVE
Prepare Coolify to manage the existing production Compose application while preserving Nginx, PostgreSQL, named volumes, and network identities.

CRITICAL SAFETY GATE
Do not deploy, stop, recreate, or migrate production containers in this phase. Produce configuration and adoption plan for review first.

TASKS
1. Inspect exact current compose.yaml and override files.
2. Classify services: web, API, PostgreSQL, Nginx, Certbot, Uptime Kuma/monitoring, and other services.
3. Confirm existing named volume names and purposes.
4. Confirm network names and service membership.
5. Confirm current port mappings. Preserve only existing public Nginx 80/443 and reviewed loopback-only management binding.
6. Confirm Nginx upstream names and Docker DNS assumptions.
7. Prepare Coolify-compatible Compose using prebuilt image references for web and API, not build: directives.
8. Keep existing database volume name exactly unchanged.
9. Keep existing network name exactly unchanged where external network model is required.
10. Inspect how Coolify normalizes project names, service names, volume names, networks, labels, and generated Compose.
11. Use Coolify deployable Compose view as mandatory review artifact before production cutover.
12. Ensure existing Nginx remains the only public edge proxy.
13. Ensure Coolify proxy mode is Custom (None) on this host.
14. Ensure no second production PostgreSQL service or replacement database volume.
15. Ensure Certbot challenge webroot and certificate volumes remain accessible to Nginx.
16. Determine how Coolify updates intended app services and what happens to DB/proxy services during deployment.
17. If Coolify Compose management would recreate PostgreSQL volume, incompatibly rename services, or break Nginx DNS routing, stop and propose staged adoption.

IMAGE TAG STRATEGY
- Production Compose uses controlled production tag for normal automated releases.
- Commit-specific tags remain available for rollback.
- Verify pull behavior for mutable production tags. Use suitable pull policy if supported and confirmed.
- Do not assume webhook guarantees fresh image pull.

DELIVERABLES
- Reviewed Coolify-compatible Compose configuration or patch.
- docs/operations/DEPLOYMENT-RUNBOOK.md.
- Before/after identity table for services, volumes, networks, and ports.
- Production cutover and rollback plan.

VALIDATION
- docker compose config validation locally.
- Static check that PostgreSQL volume names and Nginx port ownership are preserved.
- Explain exact Coolify UI fields to inspect.
- No production deployment.

Stop after 11.4 and wait for explicit approval.
```

---

# Prompt 11.5 — GitHub Actions CI → GHCR → Coolify CD

```text
Implement Milestone 11.5: Automated GitHub Actions Build, Publish, and Coolify Deployment.

OBJECTIVE
Automate production deployment only after all required checks pass and every required application image is available in GHCR.

FIRST INSPECT
- Existing GitHub Actions workflows.
- Tests, lint, typecheck, and build commands for web and API.
- Dockerfiles and build contexts.
- Image names and GHCR permissions.
- Approved Coolify webhook/API integration.
- Existing production branch and release policy.

WORKFLOW REQUIREMENTS
1. Reuse/refactor existing CI workflows; avoid duplicate workflows.
2. Trigger production delivery only for approved branch or release event.
3. Run required tests/checks before publishing production tags.
4. Build web and API images.
5. Publish each image with sha-<commit-sha> and production tags.
6. Ensure both tags refer to the same build output.
7. Use GITHUB_TOKEN with minimal permissions, including packages: write.
8. Use platform architecture confirmed in 11.3.
9. Publish all required images before deployment.
10. Capture image digests and commit SHA in workflow summary/artifact.
11. Add final deployment job depending on all checks and image-publishing jobs.
12. Trigger Coolify exactly once using authenticated deploy webhook/API.
13. Store webhook and token in GitHub Actions secrets:
    - COOLIFY_WEBHOOK
    - COOLIFY_TOKEN
14. Do not print webhook URL or token.
15. Fail if Coolify trigger returns unsuccessful HTTP status.
16. Add concurrency group to prevent overlapping production deployments.
17. Configure cancellation deliberately; do not cancel in-progress production deploy without understanding impact.
18. Ensure pull requests cannot access production secrets or trigger production deploy.
19. Ensure Coolify direct Git push auto-deploy is disabled to prevent duplicate deployment.
20. Do not add independent SSH deploy script that also updates same Compose stack.

IMPORTANT
A successful webhook response only confirms Coolify accepted the request. It does not prove deployment completed. Completion and smoke tests are handled in 11.6.

IMPLEMENTATION
- Use current official Coolify GitHub Actions guidance.
- Use careful quoting and secret masking.
- Do not put secrets in command echo output.
- Avoid exposing secret-bearing webhook URLs in logs.
- Keep workflow syntax and action versions consistent with repository policy.
- Explain unavoidable limitations.

DELIVERABLES
- Updated .github/workflows files.
- docs/operations/CI-CD-PIPELINE.md.
- docs/operations/DEPLOYMENT-RUNBOOK.md updated with secret setup and trigger behavior.
- Workflow dependency diagram.

VALIDATION
- YAML syntax validation.
- Static workflow review.
- Run available CI checks locally.
- Do not claim live deployment succeeded.
- Provide safe first-run procedure after approval.

Stop after 11.5 and wait for review.
```

---

# Prompt 11.6 — Deployment health verification and rollback

```text
Implement Milestone 11.6: Post-Deployment Verification, Failure Handling, and Rollback.

OBJECTIVE
Ensure each automated release can be verified and a known-good release can be restored safely.

TASKS
1. Inspect health checks for web, API, database, and proxy.
2. Confirm health-check start periods, intervals, retries, and timeouts.
3. Create post-deployment verification runbook.
4. Verify exact commit SHA and image digests deployed.
5. Verify Coolify deployment logs and final deployment state.
6. Verify Docker container health.
7. Verify public HTTPS homepage:
   https://luffydev.duckdns.org/
8. Verify public API health:
   https://luffydev.duckdns.org/api/health
9. Verify one representative read-only API endpoint.
10. Verify Uptime Kuma status and notification behavior.
11. Document what to inspect if webhook accepted but deployment failed.
12. Document what to inspect if deployment succeeds but app returns 502/504.
13. Create rollback procedure using previous immutable commit-specific tags or digests.
14. Confirm web and API image pair belongs to a compatible release.
15. Explain how to select previous release in Coolify/Compose.
16. Explain how to restore production tag or image reference after rollback.
17. Keep database unchanged during application-only rollback.
18. Document separate process if release included a non-backward-compatible database migration.
19. Add deployment record template: commit, image digests, start/end time, status, smoke-test result, rollback reference.

SAFETY
- Do not test rollback by overwriting live database.
- Do not delete previous images.
- Do not claim deployment success from webhook response alone.
- Prefer staging or controlled maintenance window for rollback experiments.

DELIVERABLES
- docs/operations/DEPLOYMENT-RUNBOOK.md.
- docs/operations/ROLLBACK.md updated for Coolify.
- Smoke-test script if useful, with strict failure handling and no secrets.
- Updated milestone report.

VALIDATION
- Validate scripts and workflows.
- If production access is not explicitly authorized, provide operator steps only.
- Distinguish automated checks from manual verification.

Stop after 11.6 and wait for review.
```

---

# Prompt 11.7 — End-to-end experiments and milestone closure

```text
Implement Milestone 11.7: End-to-End CI/CD Experiments and Final Documentation.

OBJECTIVE
Demonstrate that the complete CI → GHCR → Coolify → OCI workload deployment pipeline works reliably and safely.

REVIEW FIRST
Inspect every previous Milestone 11 deliverable and identify missing evidence. Do not mark a requirement complete based only on workflow or documentation existence.

REQUIRED EXPERIMENTS
1. Perform baseline Coolify deployment of current known-good release.
2. Merge a harmless application change into approved production branch.
3. Verify required CI checks run and pass.
4. Verify both web and API images are published with correct commit-specific tags.
5. Verify controlled production tags point to expected images.
6. Verify Coolify is triggered only after all required images are available.
7. Verify exactly one production deployment is created.
8. Verify Coolify pulls expected images and reports deployment completion.
9. Verify deployed commit and image digests.
10. Verify public homepage, API health, representative endpoint, and Uptime Kuma.
11. Introduce a test failure and verify deployment is skipped.
12. Verify pull request cannot access production secrets or trigger production deployment.
13. Verify overlapping workflow runs are controlled.
14. Perform safe rollback to previous commit-specific release.
15. Verify PostgreSQL data, volume identity, Nginx, TLS, and monitoring remain intact.

Use isolated/staging resource for destructive or deliberately broken release tests whenever possible. Do not intentionally break the only production instance.

FOR EACH EXPERIMENT RECORD
- Experiment ID.
- Objective.
- Preconditions.
- Exact action.
- Expected result.
- Actual result.
- GitHub Actions run reference.
- GHCR image tags/digests.
- Coolify deployment reference.
- Smoke-test output.
- Recovery/rollback action.
- Final status.
- Lessons and follow-up work.

FINAL DOCUMENTATION
Create or complete docs/operations/MILESTONE-11.md with:
1. Executive summary.
2. Approved architecture decision.
3. Control-plane and workload-server topology.
4. Proxy ownership and network flow.
5. GHCR image naming/tag policy.
6. GitHub Actions workflow and permissions.
7. Coolify resource configuration.
8. Secrets and registry authentication procedure, without secret values.
9. CI/CD sequence diagram.
10. Deployment verification.
11. Failure handling.
12. Rollback procedure.
13. Experiment evidence.
14. Known limitations and remaining risks.
15. Definition-of-done checklist.

FINAL SAFETY REVIEW
- Check for secret leakage.
- Check direct push auto-deploy is not causing duplicate deployments.
- Check Coolify proxy does not own workload ports 80/443.
- Check existing Nginx still owns public edge.
- Check PostgreSQL volume and network identities are preserved.
- Check production Compose references prebuilt images.
- Check previous immutable images remain available for rollback.
- Check production tag behavior is understood.
- Check failed CI does not deploy.
- Check deployment completion is verified beyond webhook acceptance.
- Check Milestone 9 and 10 behavior has not regressed.

Classify each criterion:
- PASS — verified with evidence.
- PARTIAL — implemented but evidence incomplete.
- FAIL — missing or unsafe.
- NOT TESTED — no execution evidence.

Do not declare Milestone 11 complete if any critical safety issue remains.

Stop and present final milestone report. Do not start another milestone.
```

---

# Final independent CI/CD review prompt

Use after all seven phases:

```text
Act as an independent Senior DevOps/SRE reviewer.

Review the entire Milestone 11 implementation against MILESTONE-11-SPEC.md.

Do not modify files initially.

Review:
- Architecture decision and control-plane placement.
- Existing Nginx and Coolify proxy ownership.
- Remote server SSH access and host-key verification.
- GHCR authentication and permissions.
- Image architecture compatibility.
- Commit-specific image tags and production tag.
- Docker Compose adoption and generated Compose output.
- PostgreSQL volume identity and persistence.
- Existing Docker network identity and Nginx upstream resolution.
- GitHub Actions permissions and job dependencies.
- Test-before-publish-before-deploy ordering.
- Coolify webhook/API authentication.
- Duplicate deployment trigger prevention.
- Concurrency controls.
- Deployment logs and image digest evidence.
- Post-deployment health checks.
- Failed CI behavior.
- Rollback to immutable images.
- Secret leakage and action pinning.
- Milestone 9 and 10 regression risks.

For every requirement classify:
1. PASS — evidence demonstrates it works.
2. PARTIAL — implemented but evidence is incomplete.
3. FAIL — missing, incorrect, or unsafe.
4. NOT TESTED — no execution evidence.

Prioritize findings:
- Critical
- High
- Medium
- Low

Return:
- Executive verdict.
- Architecture assessment.
- Requirement scorecard.
- Critical and high-risk findings.
- Exact remediation steps.
- Remaining acceptance criteria.
- Final recommendation: READY, READY WITH CONDITIONS, or NOT READY.

Do not declare the milestone complete if production data, routing, TLS, secrets, or rollback safety is at risk.
```

---

## Execution order

| Order | Prompt | Output |
|---|---|---|
| 0 | Milestone-wide instructions | Agent operating rules |
| 1 | 11.1 | Architecture decision |
| 2 | 11.2 | Coolify and remote server connection |
| 3 | 11.3 | GHCR authentication and image strategy |
| 4 | 11.4 | Compose adoption plan |
| 5 | 11.5 | Automated CI/CD workflow |
| 6 | 11.6 | Health verification and rollback |
| 7 | 11.7 | End-to-end experiments and documentation |
| 8 | Final review | Independent CI/CD assessment |

**Important:** Do not skip the 11.1 and 11.4 review gates. The existing Nginx listener and PostgreSQL volume are the two most important pieces of infrastructure to protect during this transition.
