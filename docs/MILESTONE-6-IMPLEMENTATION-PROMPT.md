# Implementation Prompt — Milestone 6: GHCR Image Publishing

You are working on the `devops-blog` full-stack JavaScript monorepo.

Implement Milestone 6: publish backend and frontend Docker images to GitHub Container Registry using GitHub Actions.

This is a hands-on DevOps learning project. Preserve the existing application and CI pipeline.

## Phase 1 — Inspect the repository

Before changing anything, inspect:

- `.github/workflows/ci.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- Root `package.json`
- Root `package-lock.json`
- `.dockerignore`
- `docs/GITHUB-ACTIONS-CI.md`
- `docs/DOCKER.md`
- `docs/DOCKER-COMPOSE.md`

Identify:

- Existing workflow triggers.
- Existing CI jobs.
- Existing job names.
- Docker build contexts.
- Current image naming.
- Existing action versions.
- Existing permissions.
- Current cache configuration.

Do not assume the workflow matches a generic template. Extend the existing workflow.

## Phase 2 — Design publishing architecture

Design the workflow so that:

1. Backend CI and frontend CI run first.
2. Docker build validation runs after required CI checks.
3. Pull requests build images but never publish.
4. Pushes to main publish both images.
5. Failed CI jobs prevent publishing.
6. Publishing uses GitHub's built-in `GITHUB_TOKEN`.

Prefer a clear publishing job with explicit dependencies.

Ensure the package-write permission is scoped to the publishing job rather than the entire workflow.

## Phase 3 — Implement GHCR publishing

Publish:

- `ghcr.io/<lowercase-owner>/devops-blog-api`
- `ghcr.io/<lowercase-owner>/devops-blog-web`

Normalize the GitHub owner to lowercase when necessary.

Use Docker Buildx and appropriate official Docker actions.

Configure:

- Buildx setup.
- GHCR login.
- Docker metadata.
- Commit SHA tags.
- `latest` tag for successful main-branch publishing.
- BuildKit GitHub Actions caching.
- Correct repository root build context.
- Existing Dockerfiles.

Use `linux/amd64` initially.

Do not publish from pull requests.

Do not add PAT credentials.

Do not publish images if backend or frontend tests fail.

## Phase 4 — Security review

Verify:

- Only the publishing job has `packages: write`.
- All other jobs have the minimum required permissions.
- `GITHUB_TOKEN` is used for GHCR login.
- No credentials are hard-coded.
- No production secrets are required.
- No package-write permission is granted to pull request jobs.
- No tokens are printed in logs.

Review whether the packages should remain private initially.

Do not change package visibility without explicit developer approval.

## Phase 5 — Local validation

Validate:

- Workflow YAML syntax.
- Action input names.
- Image names.
- Tag generation.
- Build contexts.
- Dockerfile paths.
- Conditional expressions.
- Job dependency graph.
- Permissions.

Run existing local checks.

If possible, build both images locally using Buildx.

Do not claim that GHCR publishing works until a real GitHub Actions run confirms it.

## Phase 6 — GitHub verification

If GitHub access and repository permissions allow:

1. Push a valid change to `main`.
2. Inspect the Actions run.
3. Confirm both images are published.
4. Inspect GitHub Packages.
5. Pull the published images.
6. Verify their tags and digests.
7. Open a pull request and confirm it does not publish images.
8. Introduce a temporary failing test and verify publishing is blocked.
9. Revert the temporary failure.

If you cannot perform these operations, give the developer exact commands and UI instructions.

Never claim an experiment succeeded unless it was actually observed.

## Phase 7 — Documentation

Create:

`docs/GHCR-IMAGE-PUBLISHING.md`

Document:

- Container registry fundamentals.
- GHCR.
- Docker Buildx.
- BuildKit cache.
- Authentication.
- `GITHUB_TOKEN`.
- Permissions.
- Image names.
- Image tags.
- Image digests.
- Private/public package visibility.
- Pulling images.
- Inspecting images.
- Architecture considerations.
- Practical experiment results.
- Troubleshooting.

Update the root README with the published image references and registry information, but only after confirming the actual owner and image names.

## Phase 8 — Final report

Provide:

1. Files created or modified.
2. Workflow architecture.
3. Explanation of each new Docker action.
4. Security and permission decisions.
5. Image naming and tagging examples.
6. Local validation commands and results.
7. Actual GitHub Actions run results.
8. GHCR package links if available.
9. Known limitations.
10. Acceptance criteria checklist.

Do not start Milestone 7.

Wait for the developer to review and confirm completion.