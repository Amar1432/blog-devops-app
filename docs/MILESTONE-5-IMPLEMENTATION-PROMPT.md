# Implementation Prompt — Milestone 5

You are working on the `devops-blog` repository, a full-stack JavaScript monorepo.

Your task is to implement **Milestone 5: GitHub Actions and Continuous Integration**.

Follow `docs/MILESTONE-5-SPEC.md` if it exists. Otherwise, follow the requirements below.

## Important instructions

This is a DevOps learning project. The goal is not simply to produce a working YAML file. The goal is to teach the developer how CI works through a real implementation.

Before making changes, inspect the repository thoroughly.

Inspect:

- Root `package.json`.
- Root `package-lock.json`.
- npm workspace configuration.
- `apps/web/package.json`.
- `apps/api/package.json`.
- Existing test and lint configurations.
- Prisma schema and migrations.
- Existing Dockerfiles.
- Existing `.github` files and workflows.
- `.gitignore` and environment variable examples.
- `docs/DOCKER.md`.
- `docs/DOCKER-COMPOSE.md`.

Do not assume commands or scripts exist. Derive the workflow from the actual repository.

Preserve the existing application architecture and business logic.

Do not introduce TypeScript, change frameworks, replace test tools, or refactor unrelated application code.

## Phase 1 — Repository assessment

Before implementation, produce a short assessment containing:

1. Node.js version required by the project.
2. npm workspace structure.
3. Available root and workspace scripts.
4. Backend test requirements.
5. Whether backend tests require PostgreSQL.
6. How Prisma migrations are applied.
7. Frontend environment variables required for building.
8. Whether existing Dockerfiles can build from the repository root.
9. Any problems that could prevent CI from succeeding.

Identify missing or broken scripts before writing the workflow.

Do not silently invent commands.

If a required script is missing, explain why it is needed and add the smallest appropriate implementation.

## Phase 2 — Design the workflow

Create:

`.github/workflows/ci.yml`

Use GitHub-hosted runners.

Configure triggers for:

- Pull requests targeting `main`.
- Pushes to `main`.
- Manual execution if useful.

Implement separate jobs for:

### Backend CI

- Checkout repository.
- Configure Node.js.
- Configure npm dependency caching.
- Install dependencies using `npm ci`.
- Run backend lint.
- Run backend tests.
- Run any additional backend validation that actually exists.

If integration tests require PostgreSQL, configure a PostgreSQL service container with:

- A dedicated CI database.
- Test-only credentials.
- A health check.
- Appropriate environment variables.
- Prisma migration execution before tests.

Do not use a developer's local database or production credentials.

### Frontend CI

- Checkout repository.
- Configure Node.js.
- Configure npm caching.
- Install dependencies using `npm ci`.
- Run frontend lint.
- Run frontend tests.
- Run frontend production build.

Supply non-sensitive placeholder environment values when required by the frontend build.

### Docker build validation

Build both images using the existing Dockerfiles:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Use the repository root as the build context.

Do not push images to any registry.

Do not modify working Dockerfiles simply to make the workflow look different. Only change them if you discover a genuine issue, and explain that issue.

## Phase 3 — Workflow quality

Apply sensible CI practices:

- Use the Node.js version compatible with the project.
- Use `npm ci`.
- Use dependency caching based on the root lockfile.
- Use least-privilege workflow permissions.
- Use descriptive job and step names.
- Avoid unnecessary secrets.
- Avoid duplicating expensive operations.
- Use concurrency controls where appropriate.
- Keep the workflow readable for someone learning GitHub Actions.

Use stable versions of third-party actions. Explain the version-pinning choice.

Do not overengineer the workflow.

## Phase 4 — Validate locally

Before considering the implementation complete:

1. Run the same lint commands used in CI.
2. Run the same test commands used in CI.
3. Run the frontend production build.
4. Build the backend Docker image.
5. Build the frontend Docker image.
6. Validate the YAML syntax and workflow configuration.
7. Confirm all referenced scripts and paths exist.
8. Check that no local `.env` files or credentials are committed.

If a check fails, investigate and fix the actual issue rather than weakening the check.

If a check cannot be run locally, explain why and provide the exact GitHub Actions validation step needed.

## Phase 5 — Documentation

Create:

`docs/GITHUB-ACTIONS-CI.md`

Document:

1. What CI means.
2. Why GitHub Actions is being used.
3. How GitHub Actions workflows are triggered.
4. What a runner is.
5. What jobs and steps mean.
6. How the backend job works.
7. How the frontend job works.
8. How Docker build validation works.
9. How npm dependency caching works.
10. How PostgreSQL service containers work, if used.
11. How to inspect workflow logs.
12. How to rerun a failed workflow.
13. How GitHub Actions secrets and variables differ.
14. How branch protection can require successful CI checks.
15. What is intentionally not implemented yet.

Update the root README with a concise CI section.

## Phase 6 — Practical experiments

Do not merely describe these experiments. Perform them if repository access and GitHub permissions allow.

1. Trigger a successful workflow.
2. Introduce a temporary failing test and observe CI failure.
3. Revert the failing test.
4. Introduce a temporary lint violation and observe CI failure.
5. Revert the lint violation.
6. Introduce a temporary frontend build error and observe CI failure.
7. Revert the build error.
8. Verify both Docker builds in CI.
9. Verify CI checks appear on a pull request.

Never leave intentionally broken code in the final branch.

If you cannot push changes or create a pull request, document the exact manual steps the developer must perform.

Do not claim an experiment succeeded unless you observed its result.

## Phase 7 — Final report

When finished, provide:

### 1. Files created or modified

List every changed file and explain why it changed.

### 2. Workflow explanation

Explain the execution flow from a GitHub push or pull request to completed CI checks.

### 3. Commands executed

List the actual local validation commands and their results.

### 4. Experiments

For every experiment, report:

- What was tested.
- What happened.
- Whether it passed.
- Any limitation.

### 5. Concepts to understand

Explain these in practical terms:

- Workflow.
- Event.
- Runner.
- Job.
- Step.
- Action.
- Environment variable.
- Secret.
- Service container.
- Dependency cache.
- Branch protection.

### 6. Known limitations

List anything not implemented or not verified.

### 7. Completion status

Compare the implementation against the Milestone 5 acceptance criteria.

Do not start Milestone 6.

Wait for the developer to review and confirm Milestone 5 completion before proceeding.