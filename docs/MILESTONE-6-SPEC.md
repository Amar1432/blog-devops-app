# Milestone 6 — Docker Image Publishing with GitHub Container Registry

## 1. Objective

Extend the existing GitHub Actions CI pipeline to automatically publish Docker images to GitHub Container Registry (GHCR).

At the end of this milestone:

- Backend Docker images are published to GHCR.
- Frontend Docker images are published to GHCR.
- Images are published automatically after successful CI on `main`.
- Pull requests build and validate images without publishing them.
- Images have traceable tags.
- Images can be pulled independently of the GitHub Actions runner.

## 2. Existing project context

Repository: `devops-blog`

Existing images:

- Backend: `devops-blog-api`
- Frontend: `devops-blog-web`

Existing Dockerfiles:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Build context: repository root (`.`), required by npm workspaces.

Existing CI:

`.github/workflows/ci.yml`

The workflow already runs:

- Backend CI.
- Frontend CI.
- Docker Build Validation.

Preserve existing quality checks.

## 3. Understand container registries

Document these concepts:

- What a container registry is.
- Why built images need to be stored remotely.
- Difference between a Docker image and a running container.
- What GHCR provides.
- Difference between Docker Hub and GHCR.
- What an image repository is.
- What image tags are.
- What an image digest is.
- Why immutable image references matter.
- Authentication and authorization for container registries.

Explain the difference between publishing an image and deploying a container.

## 4. GHCR configuration

Use GHCR:

`ghcr.io`

Publish two independent image repositories:

- `ghcr.io/<github-owner>/devops-blog-api`
- `ghcr.io/<github-owner>/devops-blog-web`

The owner portion must be normalized to lowercase if necessary.

Use the built-in GitHub Actions `GITHUB_TOKEN` for authentication.

Do not create or store a personal access token just to publish images from GitHub Actions.

Configure permissions using least privilege:

- `contents: read`
- `packages: write` only for the publishing job.

Do not grant package-write permissions to unrelated CI jobs.

## 5. Update the GitHub Actions workflow

Modify:

`.github/workflows/ci.yml`

Keep existing triggers:

- Pull requests targeting `main`.
- Pushes to `main`.
- Manual workflow execution.

### Pull request behavior

For pull requests:

- Run backend CI.
- Run frontend CI.
- Build backend Docker image.
- Build frontend Docker image.
- Do not authenticate to GHCR unnecessarily.
- Do not publish any images.

### Main branch behavior

For pushes to `main`:

1. Run backend CI.
2. Run frontend CI.
3. Build Docker images.
4. Publish backend image.
5. Publish frontend image.

Publishing must only happen if required CI jobs pass.

Do not publish images from failed builds or failed tests.

Use a dedicated publishing job or a carefully designed Docker job with appropriate dependencies.

## 6. Docker Buildx

Introduce Docker Buildx.

Learn and document:

- What Docker Buildx is.
- Difference between `docker build` and `docker buildx build`.
- Why Buildx is useful in CI.
- How BuildKit caching works.
- What multi-platform builds mean.

Use the following official actions or equivalent stable alternatives:

- `docker/setup-buildx-action`
- `docker/login-action`
- `docker/metadata-action`
- `docker/build-push-action`

Pin action versions appropriately and explain the choice.

Use the existing Dockerfiles and repository root build context.

Do not refactor application code or Dockerfiles unless there is a genuine technical requirement.

## 7. Image tagging strategy

Publish at least these tags:

### Commit-based tag

`sha-<short-commit-sha>`

Example:

`ghcr.io/<owner>/devops-blog-api:sha-a1b2c3d`

Purpose:

- Identifies the exact source commit.
- Allows a previous image to be pulled again.
- Provides traceability between source code and image.

### Latest tag

`latest`

Purpose:

- Points to the latest successful image published from `main`.
- Provides a convenient reference for learning and manual testing.

Use the same tagging policy for frontend and backend images.

Document why `latest` should not be treated as an immutable production deployment reference.

## 8. Build cache

Configure GitHub Actions BuildKit caching using GitHub Actions cache storage.

Learn:

- What build layers are.
- How Docker decides whether a layer can be reused.
- Why dependency layers should be cached.
- What `cache-from` and `cache-to` mean.
- How cached builds reduce CI time.

Do not introduce a complicated cache strategy.

## 9. Image architecture

For this milestone, keep the build architecture simple.

Prefer `linux/amd64` initially because the GitHub-hosted Ubuntu runner and typical learning VPS environment use AMD64.

Document that the developer's Apple Silicon Mac uses ARM64 and that an AMD64 image may run through emulation.

Multi-platform publishing for `linux/amd64` and `linux/arm64` can be added later if there is a practical requirement.

Do not introduce multi-platform complexity without explaining it.

## 10. Verify published images

After a successful push to `main`:

1. Open the repository's Packages section on GitHub.
2. Verify both packages exist.
3. Verify the expected tags exist.
4. Inspect image metadata and digest.
5. Pull the published images locally.
6. Inspect image architecture.
7. Verify that both images can be pulled without building them locally.

Use commands similar to:

```bash
docker pull ghcr.io/<owner>/devops-blog-api:latest

docker pull ghcr.io/<owner>/devops-blog-web:latest

docker image inspect ghcr.io/<owner>/devops-blog-api:latest

docker image inspect ghcr.io/<owner>/devops-blog-web:latest
```

If the packages are private, document the authentication process needed for local pulls.

Do not expose access tokens in terminal output or documentation.

## 11. Package visibility and permissions

Document:

- Private versus public GHCR packages.
- How to view package settings.
- How to link packages to the GitHub repository.
- How package access permissions work.
- How to change visibility if appropriate.
- Why a public package can be pulled without authentication.
- Why private packages require authentication.

Do not make packages public without confirming that the developer intends to do so.

## 12. Practical experiments

Perform and document these experiments:

### Experiment 1 — Publish on main

Push a valid change to `main`.

Verify that both images are published successfully.

### Experiment 2 — Pull images

Pull both published images from GHCR using Docker CLI.

### Experiment 3 — Tag verification

Verify that both `latest` and commit-based tags exist.

### Experiment 4 — Pull request protection

Open a pull request.

Verify that Docker build validation runs but no image publishing occurs.

### Experiment 5 — CI failure protection

Introduce a temporary failing test.

Verify that publishing does not happen for that failed commit.

Revert the temporary failure.

### Experiment 6 — Build cache

Run a subsequent image build.

Inspect BuildKit logs and identify whether cached layers were reused.

### Experiment 7 — Image traceability

Inspect image tags and digests.

Explain how to identify which source commit produced a particular image.

## 13. Deliverables

- Updated `.github/workflows/ci.yml`
- `docs/GHCR-IMAGE-PUBLISHING.md`
- Updated root `README.md`

Documentation should cover:

- GHCR architecture.
- Authentication.
- Permissions.
- Image naming.
- Tagging strategy.
- Buildx.
- Build caching.
- Package visibility.
- Pull commands.
- Image inspection.
- Experiment results.
- Troubleshooting.

## 14. Out of scope

Do not implement:

- VPS deployment.
- Coolify.
- Automatic container deployment.
- Kubernetes.
- Terraform.
- Ansible.
- Production reverse proxy.
- TLS.
- Production database provisioning.
- Automated rollback.

These belong to later milestones.

## 15. Acceptance criteria

- [ ] Both images are published to GHCR.
- [ ] Publishing happens only on successful pushes to `main`.
- [ ] Pull requests never publish images.
- [ ] Publishing waits for backend and frontend CI to succeed.
- [ ] Images have commit-based tags.
- [ ] Images have a `latest` tag.
- [ ] GitHub Actions uses `GITHUB_TOKEN`.
- [ ] Package-write permissions are restricted to the publishing job.
- [ ] Docker Buildx caching is configured.
- [ ] Both published images can be pulled locally.
- [ ] Package visibility and permissions are documented.
- [ ] Experiments and results are documented.

**Definition of success:** A successful commit to `main` produces two version-traceable Docker images in GHCR, ready to be deployed on another machine.