# Milestone 5 — GitHub Actions & Continuous Integration

## 1. Objective

Implement a reliable CI pipeline for the `devops-blog` monorepo using GitHub Actions.

By the end of this milestone, every pull request targeting `main` and every push to `main` should automatically run the project's quality checks.

The pipeline must catch broken code before it is merged.

**Learning outcomes**

Understand:

- What CI is and why teams use it.
- What a GitHub Actions workflow is.
- Workflows, events, jobs, steps, and runners.
- GitHub-hosted runners.
- Workflow triggers: `push` and `pull_request`.
- Actions and reusable marketplace actions.
- Environment variables and secrets.
- Dependency caching.
- Job execution order and parallelism.
- PostgreSQL as a CI service container.
- Build and test failures in automated pipelines.
- Workflow logs and debugging.

## 2. Existing application context

Repository: `devops-blog`

Monorepo:

- `apps/web` — React + Vite + JavaScript.
- `apps/api` — Node.js + Express + JavaScript.
- PostgreSQL with Prisma ORM.
- npm workspaces.
- Jest, Supertest, React Testing Library, and ESLint were introduced in earlier milestones.
- Dockerfiles and Docker Compose already exist.

The implementation must inspect the actual repository scripts and configuration before designing the workflow. Do not assume package names, script names, or test database requirements.

## 3. CI workflow requirements

Create:

`/.github/workflows/ci.yml`

### Trigger conditions

Run CI on:

- Pull requests targeting `main`.
- Pushes to `main`.

Optionally support manual execution through `workflow_dispatch`.

Do not run on every branch push unless there is a clear reason. Pull requests should validate feature branches before merging.

### Job 1 — Backend checks

The backend job should:

1. Check out the repository.
2. Set up the Node.js version compatible with the project.
3. Enable npm dependency caching using the root lockfile.
4. Install dependencies reproducibly using `npm ci`.
5. Run backend linting.
6. Run backend tests.
7. Run backend build or validation commands if the backend defines them.

If backend integration tests require PostgreSQL:

- Configure a PostgreSQL service container.
- Provide a dedicated test database and credentials.
- Wait for PostgreSQL readiness using a health check.
- Set the backend's test environment variables.
- Apply migrations using the repository's existing Prisma migration setup.
- Run tests against the CI database.

Do not use production or development database credentials in GitHub Actions.

If tests do not require a database, do not add an unnecessary PostgreSQL service.

### Job 2 — Frontend checks

The frontend job should:

1. Check out the repository.
2. Set up the compatible Node.js version.
3. Enable npm caching.
4. Install dependencies reproducibly.
5. Run frontend linting.
6. Run frontend tests.
7. Run the frontend production build.

Use placeholder or non-sensitive values for frontend build-time variables if the application requires them. CI must not depend on a developer's local `.env` file.

### Job 3 — Docker build validation

Add a job that validates that both existing Docker images can be built:

- Backend image.
- Frontend image.

Use the existing Dockerfiles and the repository root as the build context, as required by the npm workspace setup.

This job should build images without pushing them to a registry.

Do not introduce GHCR publishing in this milestone.

If practical, run Docker builds in parallel with application checks. Avoid unnecessary dependencies between jobs.

## 4. Workflow quality requirements

The workflow should:

- Use a supported Node.js version matching the project.
- Use `npm ci`, not `npm install`.
- Use dependency caching correctly.
- Avoid committing secrets.
- Use GitHub Actions permissions with least privilege.
- Pin third-party actions to stable major versions or immutable SHAs where appropriate.
- Use descriptive job and step names.
- Fail immediately when a required quality check fails.
- Avoid duplicating dependency installation unnecessarily.
- Use a concurrency group to cancel outdated runs for the same pull request or branch where appropriate.

Do not add unnecessary matrix builds, self-hosted runners, deployment environments, or complex reusable workflows.

## 5. GitHub repository configuration

Document any repository configuration required for CI.

For this milestone:

- No production secrets should be required.
- Any test-only values should be defined in the workflow.
- Explain the difference between GitHub Actions variables and secrets.
- Explain where workflow permissions are configured.

Do not configure automatic deployment.

## 6. Practical experiments

Perform and document these experiments:

### Experiment 1 — Successful CI run

Push a valid change to a branch and open a pull request.

Verify that the workflow runs and all jobs pass.

### Experiment 2 — Test failure

Introduce a temporary failing test.

Push the change and verify that CI fails.

Revert the temporary failure.

### Experiment 3 — Lint failure

Introduce a temporary lint violation.

Verify that the relevant job fails.

Revert the violation.

### Experiment 4 — Build failure

Introduce a temporary frontend build error.

Verify that CI detects it.

Revert the error.

### Experiment 5 — Docker build validation

Verify that both Docker images build successfully in the GitHub Actions runner.

### Experiment 6 — Pull request protection

Verify that CI runs on a pull request and that its result is visible in the pull request checks.

Document how a repository administrator can require the CI check to pass before merging through branch protection or repository rulesets.

Do not enable mandatory branch protection without confirming the repository's current configuration and access.

## 7. Deliverables

- `.github/workflows/ci.yml`
- `docs/GITHUB-ACTIONS-CI.md`
- Updated `README.md` with CI status or workflow information, if appropriate.

The documentation must include:

- CI architecture.
- Workflow trigger explanation.
- Job and step breakdown.
- Runner explanation.
- Dependency caching.
- PostgreSQL service-container setup, if used.
- GitHub Actions secrets and variables.
- How to inspect failed workflow logs.
- How to rerun a failed workflow.
- How to require successful checks before merging.
- Results of all practical experiments.

## 8. Out of scope

Do not implement:

- GHCR image publishing.
- Automatic deployment.
- Cloud infrastructure.
- Coolify.
- Kubernetes.
- Terraform or Ansible.
- Production secrets management.
- Release tagging and versioning.

These belong to later milestones.

## 9. Acceptance criteria

Milestone 5 is complete when:

- [ ] CI runs on pull requests targeting `main`.
- [ ] CI runs on pushes to `main`.
- [ ] Backend lint and tests pass.
- [ ] Frontend lint, tests, and production build pass.
- [ ] Docker images build successfully without being pushed.
- [ ] A deliberately failing test causes CI to fail.
- [ ] A deliberately failing lint check causes CI to fail.
- [ ] No production secrets are committed or required.
- [ ] Workflow documentation is complete.
- [ ] CI results are visible in GitHub pull requests.

**Definition of success:** A developer cannot accidentally merge code that fails the required automated checks, once the repository's branch rules require those checks.