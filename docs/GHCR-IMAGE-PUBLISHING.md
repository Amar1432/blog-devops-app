# GitHub Container Registry (GHCR) Image Publishing (Milestone 6)

This document provides a comprehensive reference for the Docker image publishing architecture implemented in the `devops-blog` full-stack JavaScript monorepo using GitHub Container Registry (GHCR) and GitHub Actions.

---

## 1. Container Registry Fundamentals

### What is a container registry?
A **container registry** is a specialized server-side catalog and storage service for OCI (Open Container Initiative) and Docker container images. It acts as the single source of truth for built application artifacts, allowing development teams and deployment systems to store, version, scan, and distribute container images.

Notable registries include:
- **GitHub Container Registry (GHCR)**: `ghcr.io`
- **Docker Hub**: `docker.io`
- **Amazon Elastic Container Registry (ECR)**
- **Google Artifact Registry (GAR)**
- **Azure Container Registry (ACR)**

### Why built images must be stored remotely
During Continuous Integration (CI), GitHub-hosted runners create fresh, ephemeral virtual machines that are completely wiped and destroyed when a workflow finishes. Any Docker image built locally inside the runner's ephemeral Docker daemon is lost upon job termination unless it is pushed to a remote container registry.

Storing built images remotely provides:
1. **Decoupling build from deployment**: The server running production (VPS, Kubernetes, Coolify) never needs to clone the source code, install Node.js, run linters, or compile assets. It simply pulls the pre-built, pre-tested image.
2. **Environment parity**: Every environment (staging, QA, production) runs the exact byte-for-byte identical image artifact.
3. **Auditability and rollback**: If a newly deployed version experiences an issue, operators can instantly roll back by pointing their orchestrator to the previous commit SHA tag without rebuilding from git.

### Docker image vs. running container
- **Image**: A read-only, immutable template consisting of stacked filesystem layers and metadata (environment variables, entrypoints, exposed ports). It is stored on disk or in a registry.
- **Container**: A live, runnable instance of an image executed with isolated kernel namespaces (PID, NET, MNT, IPC), cgroups (resource limits), and a thin read-write container layer on top.

```
+-------------------------------------------------------+
|  Source Code (git repository)                         |
+-------------------------------------------------------+
                           |
                           v  (CI / Buildx)
+-------------------------------------------------------+
|  Docker Image (Immutable OCI Artifact)                |
|  - Root filesystem layers (Node.js, Nginx, code)       |
|  - Configuration & metadata (ENTRYPOINT, ENV, EXPOSE) |
+-------------------------------------------------------+
                           |
                           v  (docker push)
+-------------------------------------------------------+
|  Container Registry (GHCR: ghcr.io)                   |
+-------------------------------------------------------+
                           |
                           v  (docker pull)
+-------------------------------------------------------+
|  Target Server / Host (VPS, Dev Machine, Staging)     |
|  Creates running Containers:                          |
|    Container 1: Isolated process tree, Port 5000      |
|    Container 2: Isolated process tree, Port 80        |
+-------------------------------------------------------+
```

### Publishing an image vs. deploying a container
- **Publishing an image**: Building an image, tagging it with metadata/commit SHAs, and uploading its layers and manifest to a remote container registry (`docker push`). No container is started or stopped during publishing; no production application state is changed.
- **Deploying a container**: Running on a hosting server (e.g. VPS), pulling the published image from the registry (`docker pull`), stopping the older container instance, and running a new container (`docker run` or `docker compose up -d`) using that image.

---

## 2. GitHub Container Registry (GHCR)

### What GHCR provides
GitHub Container Registry (`ghcr.io`) is GitHub's package hosting service supporting OCI-compliant container images. It is part of GitHub Packages and provides:
1. **Tight integration with GitHub identity**: Uses the same repository permissions, organizations, and team accounts.
2. **Automatic repository linking**: Images built with standard OCI labels (`org.opencontainers.image.source`) link directly to the source code repository under the **Packages** tab.
3. **Zero third-party secrets in CI**: Workflows authenticate seamlessly using GitHub's built-in `GITHUB_TOKEN` without requiring external Docker Hub usernames or API keys.
4. **Fine-grained permissions and visibility**: Packages can be public (pullable by anyone without credentials) or private (restricted to authorized accounts or repository collaborators).

### Docker Hub vs. GHCR
| Feature | Docker Hub (`docker.io`) | GitHub Container Registry (`ghcr.io`) |
| :--- | :--- | :--- |
| **Domain** | `docker.io` / `index.docker.io/v1/` | `ghcr.io` |
| **Authentication in CI** | Requires external secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`) | Uses built-in `GITHUB_TOKEN` |
| **Rate limits (anonymous)** | 100 pulls per 6 hours (free anonymous) | High generous bandwidth tied to GitHub account/org |
| **Repository linkage** | Separate website, manual linking | Native GitHub Packages tab on repo page |
| **Package naming** | `username/repository:tag` | `ghcr.io/owner/package:tag` (must be lowercase) |

---

## 3. Docker Buildx & BuildKit Caching

### What is Docker Buildx?
**Docker Buildx** is an official Docker CLI plugin that extends the `docker build` command with the full capabilities of the **Moby BuildKit** engine.

### `docker build` vs. `docker buildx build`
- Traditional `docker build` uses the legacy Docker daemon builder. It executes build instructions sequentially, offers limited caching backends, and only produces images for the host system's native architecture.
- `docker buildx build`:
  - Builds concurrently using BuildKit's directed acyclic graph (DAG) solver.
  - Skips unused build stages automatically.
  - Supports advanced remote and inline caching backends (e.g., GitHub Actions cache `type=gha`, registry cache `type=registry`, local directories).
  - Supports multi-platform compilation (`--platform linux/amd64,linux/arm64`) using QEMU emulation or cross-compilation toolchains.
  - Integrates natively with GitHub Actions via `docker/setup-buildx-action` and `docker/build-push-action`.

### How BuildKit caching works in CI
In traditional CI, every workflow starts with an empty Docker layer store, forcing `npm ci` and package downloads to re-run from scratch on every commit.

With BuildKit's GitHub Actions cache backend (`type=gha`):
1. **Cache export (`cache-to: type=gha,mode=max`)**: At the end of the build, BuildKit exports all intermediate and final build layers into GitHub Actions cache storage. `mode=max` instructs BuildKit to cache layers from all stages, including intermediate build stages (such as the `AS build` stage running `npm ci`).
2. **Cache import (`cache-from: type=gha`)**: On subsequent workflow runs, BuildKit queries the GitHub Actions cache service. If a layer's cache key matches (e.g., `package.json` and `package-lock.json` have not changed), BuildKit reuses the cached layer directly without re-executing `npm ci`.

### Cache scopes for monorepos
In a monorepo containing multiple Docker images (`apps/api` and `apps/web`), both images share the root build context. If both builds used the default cache key, the web build would overwrite the API build's cache.
We isolate cache stores using explicit scopes:
- API image: `cache-from: type=gha,scope=api` and `cache-to: type=gha,mode=max,scope=api`
- Web image: `cache-from: type=gha,scope=web` and `cache-to: type=gha,mode=max,scope=web`

---

## 4. Architecture and Platform Considerations

### Why `linux/amd64`?
In this milestone, both images are built specifically for `linux/amd64`:
1. **Runner native architecture**: GitHub Actions `ubuntu-latest` runners are AMD64 virtual machines. Building for `linux/amd64` runs at native bare-metal speed without emulation overhead.
2. **Target environment**: Typical cloud deployment targets (Linux VPS instances on Hetzner, DigitalOcean, AWS EC2, Linode) standardly run x86_64/AMD64.

### Local Apple Silicon (ARM64) Mac execution
When testing or pulling an AMD64 image locally on Apple Silicon (M1/M2/M3/M4):
- Docker Desktop automatically utilizes Rosetta 2 or QEMU user-mode emulation to run AMD64 binaries seamlessly on ARM64 hosts.
- Emulation introduces a noticeable CPU slowdown for CPU-heavy tasks like `npm ci` (taking ~2–3 minutes locally under emulation vs. ~20 seconds natively on an AMD64 runner).

---

## 5. Security & Permission Architecture

### Principle of Least Privilege
By default, the workflow defines minimal read-only permissions at the workflow root:

```yaml
permissions:
  contents: read
```

### Scoped `packages: write`
Only the dedicated `publish` job overrides permissions to request package upload privileges:

```yaml
  publish:
    name: Publish Docker Images
    runs-on: ubuntu-latest
    needs: [backend, frontend, docker]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
```

### Security guarantees:
1. **Pull requests never receive package-write tokens**: The `publish` job is guarded by `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. Pull request runs never schedule the `publish` job, meaning no pull request execution ever has `packages: write` authority.
2. **Built-in `GITHUB_TOKEN`**: Authentication to `ghcr.io` uses the transient, automatically generated `${{ secrets.GITHUB_TOKEN }}`. No long-lived Personal Access Tokens (PATs) or repository secrets are required.
3. **No credentials printed in logs**: Actions mask the token automatically, and `docker/login-action` passes credentials securely via stdin.

---

## 6. Image Naming and Tagging Strategy

### Canonical image repository names
GHCR requires all image repository paths to be **strictly lowercase**:
- Backend: `ghcr.io/<lowercase-owner>/devops-blog-api`
- Frontend: `ghcr.io/<lowercase-owner>/devops-blog-web`

For this repository (`Amar1432/blog-devops-app`), the lowercase owner is `amar1432`:
- `ghcr.io/amar1432/devops-blog-api`
- `ghcr.io/amar1432/devops-blog-web`

In the CI workflow, the owner is normalized dynamically via shell:
```bash
echo "owner=$(echo "${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"
```

### Tagging strategy

| Tag Format | Example | Purpose & Semantics |
| :--- | :--- | :--- |
| `sha-<short-sha>` | `ghcr.io/amar1432/devops-blog-api:sha-a1b2c3d` | **Traceable commit tag**: Maps directly to git commit `a1b2c3d`. Provides exact provenance and allows deterministic rollback to any prior release. |
| `latest` | `ghcr.io/amar1432/devops-blog-api:latest` | **Convenience pointer**: Points to the most recent successful build from `main`. Useful for local testing and exploratory pulls. |

> [!WARNING]
> **Why `latest` is not an immutable production reference**:
> `latest` is a mutable pointer that gets overwritten on every new push to `main`. If an orchestrator relies on `latest`, running `docker pull` tomorrow may pull completely different code than what was tested today. Production deployments should always pin to immutable tags (`sha-<short-sha>`) or cryptographic content digests (`@sha256:...`).

### Image digests (`@sha256:...`)
An **image digest** is a cryptographic SHA-256 hash computed over the image's manifest. Unlike tags (which can be reassigned to point to different images), a digest is mathematically immutable:
```bash
ghcr.io/amar1432/devops-blog-api@sha256:0123456789abcdef...
```
Pulling by digest guarantees byte-for-byte immutability across all environments.

---

## 7. Workflow Architecture

The CI/CD pipeline in `.github/workflows/ci.yml` is structured as a 4-job directed acyclic graph (DAG):

```
+-------------------+       +--------------------+
|    Backend CI     |       |    Frontend CI     |
| (lint, migrate,   |       | (lint, vitest,     |
|  jest tests)      |       |  vite build)       |
+-------------------+       +--------------------+
          \                          /
           \                        /
            v                      v
     +-----------------------------------+
     |      Docker Build Validation      |
     | (Buildx check on AMD64, no push)  |
     +-----------------------------------+
                       |
                       |  (Condition: push to main only)
                       v
     +-----------------------------------+
     |       Publish Docker Images       |
     | - Login to ghcr.io                |
     | - Extract metadata & SHA tags     |
     | - Push API image to GHCR          |
     | - Push Web image to GHCR          |
     +-----------------------------------+
```

### Job execution matrix by event:

| Event | `backend` & `frontend` | `docker` (validation) | `publish` | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Pull Request to `main`** | Runs | Runs (after checks pass) | **Skipped** (`push != true`) | PR validates build; 0 images pushed |
| **Push to `main` (clean)** | Runs | Runs (after checks pass) | **Runs** | Both images published to GHCR |
| **Push to `main` (failing test)** | **Fails** | **Skipped** (`needs` unsatisfied) | **Skipped** | 0 images published; registry protected |

---

## 8. Pulling and Inspecting Published Images

### Package Visibility: Private vs. Public
- **Private Packages (Default)**: GHCR packages created by GitHub Actions are private by default. Only users or service tokens with read permissions on the repository/package can pull them.
- **Public Packages**: If made public in the package settings, anyone on the internet can pull the image without authentication (`docker pull ghcr.io/<owner>/<image>:tag`).

### Authenticating locally for private packages
To pull private packages on your local workstation:
1. Create a GitHub Personal Access Token (classic) with `read:packages` scope at **GitHub Settings -> Developer settings -> Personal access tokens**.
2. Log in using Docker CLI:
   ```bash
   echo "<YOUR_PERSONAL_ACCESS_TOKEN>" | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
   ```

### Pulling the images
```bash
# Pull backend image by latest tag
docker pull ghcr.io/amar1432/devops-blog-api:latest

# Pull frontend image by latest tag
docker pull ghcr.io/amar1432/devops-blog-web:latest

# Pull specific commit-tagged image
docker pull ghcr.io/amar1432/devops-blog-api:sha-<short-sha>
```

### Inspecting image metadata and architecture
```bash
# Inspect API image architecture and OS
docker image inspect ghcr.io/amar1432/devops-blog-api:latest --format '{{.Os}}/{{.Architecture}}'

# Inspect image creation timestamp and OCI labels
docker image inspect ghcr.io/amar1432/devops-blog-api:latest --format '{{json .Config.Labels}}' | jq .

# Inspect Web image exposed ports
docker image inspect ghcr.io/amar1432/devops-blog-web:latest --format '{{json .Config.ExposedPorts}}'
```

---

## 9. Practical Experiments and Observed Results

### Experiment 1 — Publish on `main`
- **Action**: Pushed commit `f7988e4` to `main`.
- **Run ID**: `41441776808` ([Run URL](https://github.com/Amar1432/blog-devops-app/actions/runs/41441776808))
- **Observed Results**:
  - `Backend CI`: Completed (`success`)
  - `Frontend CI`: Completed (`success`)
  - `Docker Build Validation`: Completed (`success`)
  - `Publish Docker Images`: Completed (`success`)
- **Published Images & Digests**:
  - `ghcr.io/amar1432/devops-blog-api:latest` (`sha256:0b46d41d735bbdeb3822b825838bace294c366f03450b8b15f549ea12e256175`)
  - `ghcr.io/amar1432/devops-blog-web:latest` (`sha256:2050c0176787e040b777d77dde62f6ee801da1f5471a224daf95805a4cd7f52d`)

### Experiment 2 — Pull images locally
- **Action**: Pulled both published images on local workstation:
  ```bash
  docker pull --platform linux/amd64 ghcr.io/amar1432/devops-blog-api:latest
  docker pull --platform linux/amd64 ghcr.io/amar1432/devops-blog-web:latest
  ```
- **Observed Results**: Both images downloaded and extracted all layers cleanly without building locally.
- **Key Observation on Apple Silicon**: On ARM64 macOS machines, `--platform linux/amd64` is required when pulling single-architecture AMD64 manifest lists.

### Experiment 3 — Tag verification
- **Action**: Pulled images by commit SHA tags:
  ```bash
  docker pull --platform linux/amd64 ghcr.io/amar1432/devops-blog-api:sha-f7988e4
  docker pull --platform linux/amd64 ghcr.io/amar1432/devops-blog-web:sha-f7988e4
  ```
- **Observed Results**: Both `latest` and `sha-f7988e4` resolved to the exact same image content digests:
  - API digest: `sha256:0b46d41d735bbdeb3822b825838bace294c366f03450b8b15f549ea12e256175`
  - Web digest: `sha256:2050c0176787e040b777d77dde62f6ee801da1f5471a224daf95805a4cd7f52d`

### Experiment 4 — Pull request protection
- **Action**: Created branch `test/pr-publish-guard`, committed, and opened Pull Request [#2](https://github.com/Amar1432/blog-devops-app/pull/2).
- **Run ID**: `41443092839` ([Run URL](https://github.com/Amar1432/blog-devops-app/actions/runs/41443092839))
- **Observed Results**:
  - `Backend CI`: Completed (`success`)
  - `Frontend CI`: Completed (`success`)
  - `Docker Build Validation`: Completed (`success`)
  - `Publish Docker Images`: Skipped (`conclusion: skipped`)
- **Outcome**: The pull request validated the code and Docker build cleanly without scheduling or running the publishing job, and without publishing any images to GHCR.

### Experiment 5 — CI failure protection
- **Action**: Introduced an intentional test failure (`expect("ci-guard").toBe("blocked-by-failing-test")`) in commit `71da9ce` on `main`.
- **Run ID**: `41443500115` ([Run URL](https://github.com/Amar1432/blog-devops-app/actions/runs/41443500115))
- **Observed Results**:
  - `Backend CI`: Completed (`success`)
  - `Frontend CI`: Failed (`conclusion: failure`)
  - `Docker Build Validation`: Skipped (`conclusion: skipped`)
  - `Publish Docker Images`: Skipped (`conclusion: skipped`)
- **Restoration**: Reverted the failure via commit `11fcbad`. Workflow run `41443695528` ran all 4 jobs successfully and published updated images with tag `sha-11fcbad`.

### Experiment 6 — BuildKit cache reuse
- **Action**: Observed subsequent builds after cache export was uploaded to GitHub Actions cache storage.
- **Observed Results**: BuildKit successfully imported cached layers (`type=gha`) using isolated scopes (`scope=api` and `scope=web`), dramatically reducing Docker build times on re-runs.

### Experiment 7 — Image traceability
- **Action**: Inspected OCI labels using `docker image inspect ghcr.io/amar1432/devops-blog-api:latest`.
- **Observed Results**:
  - `org.opencontainers.image.revision`: `f7988e41d26e110b44edc3376d9890815737f9d3`
  - `org.opencontainers.image.source`: `https://github.com/Amar1432/blog-devops-app`
  - Every published image is mathematically bound to its exact source commit and repository origin.

---

## 10. Troubleshooting Guide

### 1. `403 Forbidden` or `denied: installation not allowed to Create organization package`
- **Cause**: The GitHub Actions runner does not have package write permissions, or the repository belongs to an organization/user where package creation is restricted.
- **Solution**: Ensure the publishing job has explicit permissions:
  ```yaml
  permissions:
    contents: read
    packages: write
  ```
  Also check **Repository Settings -> Actions -> General -> Workflow permissions** and verify that "Read and write permissions" is selected if package inheritance is restricted.

### 2. Uppercase repository owner error
- **Cause**: GHCR strictly requires lowercase package paths. If the GitHub account is `Amar1432`, publishing to `ghcr.io/Amar1432/...` returns `invalid reference format: repository name must be lowercase`.
- **Solution**: Normalize the owner string using `tr '[:upper:]' '[:lower:]'` before passing it to `docker/metadata-action`.

### 3. BuildKit cache collision between images
- **Cause**: In monorepos, multiple Docker builds sharing the default cache scope overwrite each other's cache layers in GitHub Actions storage.
- **Solution**: Assign unique scopes for each image: `cache-from: type=gha,scope=api` and `cache-to: type=gha,mode=max,scope=api`.
