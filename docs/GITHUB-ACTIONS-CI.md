# GitHub Actions & Continuous Integration (Milestone 5)

This guide documents the Continuous Integration (CI) pipeline implemented for the `devops-blog` full-stack JavaScript monorepo using GitHub Actions.

It covers core CI/CD concepts, pipeline architecture, runner mechanics, database service containers, dependency caching, troubleshooting workflows, branch protection rules, and practical experiments demonstrating how CI detects failures before code reaches `main`.

---

## 1. What Continuous Integration (CI) means

**Continuous Integration (CI)** is a software engineering practice where developers regularly merge their code changes into a central repository (such as the `main` branch). Each integration is automatically verified by building the project and running automated tests and linters against the proposed changes.

### Why teams use CI

In traditional software development without automated CI:
- **"Integration Hell"**: Developers work in silos for days or weeks on feature branches. When they finally attempt to merge into `main`, merge conflicts, broken dependencies, schema mismatches, and regression bugs collide all at once.
- **Manual verification fallacy**: Relying on developers to remember to run every linter, test suite, and build command locally before pushing is error-prone. A developer might run tests against an outdated local database or skip tests when in a rush.
- **Slow feedback loop**: Bugs introduced in code might only be detected in staging or production days later, making root-cause diagnosis significantly harder and more expensive.

### How CI solves this

CI turns verification into an automated, repeatable, and objective gatekeeper:
1. **Automated guardrails**: Every pull request automatically triggers an isolated runner environment.
2. **Immediate feedback**: Within minutes of pushing a commit, the developer knows whether their changes pass static analysis (linting), unit/component tests, end-to-end flows, and production builds.
3. **Protected mainline**: By combining CI checks with branch protection rules, the repository guarantees that broken code cannot be merged into `main`.

---

## 2. Why GitHub Actions is used

GitHub Actions is a continuous integration and continuous delivery (CI/CD) platform natively integrated into GitHub.

Key advantages for this project:
- **Native repository integration**: No external CI servers (like Jenkins) to provision, patch, or maintain. Workflow configuration lives right alongside application source code in `.github/workflows/`.
- **GitHub-hosted runners**: Managed virtual machines (e.g., `ubuntu-latest`) spun up on-demand with fresh operating systems, Node.js, Docker, and common development tools pre-installed.
- **Service containers**: Native support for Docker sidecars (such as PostgreSQL) running alongside test jobs with built-in health checks and network isolation.
- **First-party action ecosystem**: Reusable, community-vetted actions for tasks like repository checkout (`actions/checkout`) and runtime setup with caching (`actions/setup-node`).
- **Granular permissions**: Least-privilege permissions configured at the workflow level (`permissions: contents: read`) to prevent unauthorized modifications.

---

## 3. GitHub Actions concepts: workflows, events, jobs, steps, and runners

A GitHub Actions pipeline is composed of five core building blocks:

```
+-------------------------------------------------------------+
| Workflow (.github/workflows/ci.yml)                         |
| Event Triggers: push to main, pull_request to main          |
+-------------------------------------------------------------+
         |
         +-------------------+-------------------+
         | (parallel)        | (parallel)        | (parallel)
         v                   v                   v
+------------------+ +------------------+ +------------------+
| Job: Backend CI  | | Job: Frontend CI | | Job: Docker Build|
| Runner: ubuntu   | | Runner: ubuntu   | | Runner: ubuntu   |
| Service: Postgres| |                  | |                  |
| Steps:           | | Steps:           | | Steps:           |
| 1. Checkout      | | 1. Checkout      | | 1. Checkout      |
| 2. Setup Node    | | 2. Setup Node    | | 2. Build API Img |
| 3. npm ci        | | 3. npm ci        | | 3. Build Web Img |
| 4. Generate DB   | | 4. Lint Web      | +------------------+
| 5. Lint API      | | 5. Test Web      |
| 6. Setup .env    | | 6. Build Web     |
| 7. Migrate DB    | +------------------+
| 8. Jest Tests    |
+------------------+
```

### 1. Workflows
A **workflow** is an automated configurable process defined in a YAML file inside `.github/workflows/`. It defines *when* the automation should run (events) and *what* it should do (jobs).

### 2. Events and Triggers
An **event** is a specific activity that triggers a workflow. In `ci.yml`:
- `pull_request` targeting `main`: Runs when a PR targeting `main` is opened, synchronized (new commit pushed), or reopened. This validates feature branches *before* merging.
- `push` to `main`: Runs whenever commits are pushed or merged directly to `main`. This guarantees that the mainline branch remains green.
- `workflow_dispatch`: Enables manual triggering directly from the GitHub UI or API for debugging and testing.

### 3. Runners
A **runner** is the compute server that executes the jobs. We use `ubuntu-latest`, a GitHub-hosted virtual machine running Ubuntu Linux. Each job runs in a pristine, fresh VM instance that is destroyed when the job finishes.

### 4. Jobs
A **job** is a set of steps executed sequentially on the same runner. By default, jobs run in **parallel**. In our workflow:
- `backend` (Backend CI)
- `frontend` (Frontend CI)
- `docker` (Docker Build Validation)
All three jobs run simultaneously across independent runners, minimizing total pipeline execution time.

### 5. Steps
A **step** is an individual task within a job. Steps within a single job share the runner's filesystem and environment. If any step fails (exits with a non-zero code), subsequent steps in that job are skipped and the job fails immediately.

### 6. Actions
An **action** is a reusable extension used as a step in a workflow. Examples:
- `actions/checkout@v4`: Checks out the git repository onto the runner.
- `actions/setup-node@v4`: Configures the Node.js runtime and caches dependencies.

---

## 4. Workflow architecture & job breakdown

The workflow configuration is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Concurrency controls

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```
- **Why it matters**: If a developer pushes three commits to a pull request within one minute, running three parallel CI builds wastes runner minutes and delays feedback.
- **Behavior**: For pull requests (`github.ref != 'refs/heads/main'`), any in-progress run for that branch is automatically cancelled when a new commit is pushed. For pushes to `main`, runs are never cancelled to ensure every production-bound commit is fully verified.

### Job 1: Backend CI

The backend job validates the Node.js API, Prisma schema, migrations, lint rules, and all test tiers (unit, component, integration, HTTP API, and E2E).

#### PostgreSQL Service Container
The backend uses real PostgreSQL integration tests (`tests/integration`, `tests/api`, `tests/e2e`). A service container is configured:

```yaml
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: devops_blog_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
```

- **Image**: `postgres:16-alpine` matches the version used in local development and Docker Compose.
- **Health check**: Uses `pg_isready` to ensure the runner waits until PostgreSQL is actively accepting TCP connections before steps run.
- **Port mapping**: `5432:5432` maps the container port to the runner host so Node.js connects directly to `localhost:5432`.
- **Database isolation**: Uses a dedicated test database name `devops_blog_test`. This matches the application's safety check requiring test databases to end in `_test`.

#### Step execution order:
1. **Checkout repository**: `actions/checkout@v4` clones the commit to the runner.
2. **Set up Node.js 22**: `actions/setup-node@v4` installs Node.js 22 and configures npm caching based on `package-lock.json`.
3. **Install dependencies**: `npm ci` cleanly installs the exact dependency tree from the lockfile without modifying it.
4. **Generate Prisma client**: `npm run db:generate --workspace=@devops-blog/api` compiles the Prisma Client into `node_modules/@prisma/client`.
5. **Run backend lint**: `npm run lint:api` runs ESLint against `apps/api/` and fails if any code style or syntax issues exist.
6. **Configure test environment**: Creates `apps/api/.env.test` with CI database credentials and test-only JWT secrets.
7. **Apply Prisma migrations**: `npm run db:deploy --workspace=@devops-blog/api` runs `prisma migrate deploy` against `devops_blog_test` to create the schema.
8. **Run backend tests**: `npm run test --workspace=@devops-blog/api` runs the full Jest suite (106 tests across 12 suites).

### Job 2: Frontend CI

The frontend job validates the React 18 + Vite single-page application.

#### Step execution order:
1. **Checkout repository**: `actions/checkout@v4` clones the commit.
2. **Set up Node.js 22**: Configures Node.js 22 and npm caching.
3. **Install dependencies**: `npm ci` installs dependencies.
4. **Run frontend lint**: `npm run lint:web` validates JSX rules, accessibility rules (`eslint-plugin-jsx-a11y`), and React Hooks rules (`eslint-plugin-react-hooks`).
5. **Run frontend tests**: `npm run test:web` executes Vitest and React Testing Library tests (55 tests across 13 test files).
6. **Run frontend production build**: `npm run build` runs `vite build` with placeholder environment variable `VITE_API_URL: http://localhost:4000/api` to verify bundling and tree-shaking succeed.

### Job 3: Docker Build Validation

Validates that both container images can be built from scratch using the existing Dockerfiles.

#### Step execution order:
1. **Checkout repository**: `actions/checkout@v4` clones the repository.
2. **Build backend Docker image**:
   ```bash
   docker build -f apps/api/Dockerfile -t devops-blog-api:ci .
   ```
3. **Build frontend Docker image**:
   ```bash
   docker build -f apps/web/Dockerfile -t devops-blog-web:ci .
   ```

- **Build context**: The repository root (`.`) is passed as the context, matching the npm workspace requirements.
- **No registry push**: Images are tagged locally on the runner and discarded when the job completes. No container registry credentials or publish steps are executed.

---

## 5. Dependency caching & performance

### How npm caching works in GitHub Actions

In `actions/setup-node@v4`:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
    cache-dependency-path: package-lock.json
```

1. **Cache directory**: npm stores downloaded tarballs in `~/.npm` (the global download cache).
2. **Cache key generation**: GitHub Actions computes a cryptographic hash of `package-lock.json`.
3. **Cache restoration**: Before `npm ci` runs, the action downloads the cached `~/.npm` archive if the hash matches.
4. **Offline installation**: When the cache hits, `npm ci` installs packages from local disk without re-downloading hundreds of megabytes of packages over the network.
5. **Cache invalidation**: If any dependency in `package-lock.json` changes, the hash changes, triggering a fresh download and updating the cache for future runs.

---

## 6. Secrets vs. Variables in GitHub Actions

GitHub Actions distinguishes between configuration variables and sensitive credentials:

| Feature | GitHub Actions Variables (`vars`) | GitHub Actions Secrets (`secrets`) |
| --- | --- | --- |
| **Purpose** | Non-sensitive configuration (URLs, ports, environments) | Sensitive data (API keys, passwords, private keys) |
| **Visibility in logs** | Plain text; visible in runner output | Automatically masked as `***` if printed in logs |
| **Access syntax** | `${{ vars.VARIABLE_NAME }}` | `${{ secrets.SECRET_NAME }}` |
| **Security level** | Standard access | Encrypted using Libsodium sealed boxes |

### No production secrets in CI

In Milestone 5:
- **No production secrets are used or committed.**
- Test credentials (such as `POSTGRES_PASSWORD: postgres` and `JWT_SECRET: test-only-secret-at-least-16-characters`) are explicitly test-scoped values defined directly in the workflow.
- They only exist inside ephemeral, disposable GitHub-hosted runners and connect to a local PostgreSQL container that is destroyed upon job completion.

---

## 7. Inspecting logs and troubleshooting failures

When a workflow fails:

1. **Locate the run**:
   - Go to the repository on GitHub.
   - Click the **Actions** tab.
   - Click on the failed workflow run (marked with a red ❌).
2. **Identify the failing job**:
   - The summary displays which job failed (`Backend CI`, `Frontend CI`, or `Docker Build Validation`).
3. **Expand step logs**:
   - Click on the failed job to view the step execution graph.
   - Click on the step with the red ❌ (e.g., `Run backend tests` or `Run frontend lint`).
   - GitHub Actions highlights the exact line of error with standard output and error streams.
4. **Re-running workflows**:
   - In the top-right corner of the workflow run page, click **Re-run jobs**.
   - You can choose **Re-run failed jobs** (to retry only the jobs that failed without re-running passed ones) or **Re-run all jobs**.

---

## 8. Branch protection rules

To ensure that developers cannot accidentally merge code that breaks CI checks:

1. In GitHub, navigate to **Settings** → **Branches** (or **Rules** → **Rulesets**).
2. Click **Add branch ruleset** or **Add rule** targeting `main`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging**.
5. In the status checks search box, select the exact job names:
   - `Backend CI`
   - `Frontend CI`
   - `Docker Build Validation`
6. Check **Require branches to be up to date before merging**.
7. Save the rule.

With this configuration, GitHub disables the "Merge pull request" button until all three CI jobs report green checkmarks.

---

## 9. Practical experiments log

The following experiments were executed against the live GitHub repository (`Amar1432/blog-devops-app`) to verify pipeline behavior under both passing and failing conditions.

### Experiment 1 — Successful CI run on pull request
- **Objective**: Verify that valid code triggers the workflow and passes all three parallel jobs on a Pull Request targeting `main`.
- **Action**: Created feature branch `feat/ci-pipeline`, committed pipeline definition, workspace scripts, and documentation, pushed to GitHub, and opened Pull Request #1 ([PR #1](https://github.com/Amar1432/blog-devops-app/pull/1)).
- **Observed Workflow Run**: [Run #1 (ID: 41435357587)](https://github.com/Amar1432/blog-devops-app/actions/runs/41435357587)
  - **Commit**: `18750bdc703b06d5557e2d4131d8c56987f157ab`
  - **Backend CI**: `completed`, `conclusion: success` (all 8 steps succeeded, Jest ran 106 tests across 12 suites against the PostgreSQL 16 service container).
  - **Frontend CI**: `completed`, `conclusion: success` (ESLint passed, Vitest passed 55 tests across 13 test files, Vite production build generated static bundles).
  - **Docker Build Validation**: `completed`, `conclusion: success` (both `apps/api/Dockerfile` and `apps/web/Dockerfile` built successfully from repo root context).
- **Result**: PASSED. Pull request checks reported green checkmarks across all three jobs.

### Experiment 2 — Intentional backend test failure
- **Objective**: Verify that a failing backend test causes the `Backend CI` job to fail and blocks PR status checks.
- **Action**: Modified `apps/api/tests/unit/slug.test.js` to assert `expect(slugify("Hello, DevOps World!")).toBe("deliberately-broken-slug-for-experiment-2")`. Committed and pushed to `feat/ci-pipeline`.
- **Observed Workflow Run**: [Run #2 (ID: 41435673494)](https://github.com/Amar1432/blog-devops-app/actions/runs/41435673494)
  - **Commit**: `ff1e66b3444a56c729ff5da7f4e1becdfc6f7c15`
  - **Backend CI**: `completed`, `conclusion: failure`.
    - Failing step: `Run backend tests` failed with non-zero exit code due to the assertion mismatch in `slug.test.js`.
  - **Frontend CI**: `completed`, `conclusion: success` (ran independently in parallel).
  - **Docker Build Validation**: `completed`, `conclusion: success` (ran independently in parallel).
  - **Pull Request Status**: PR #1 check marked `Backend CI` with ❌ failure.
- **Recovery**: Reverted the assertion in commit `8e3d61a` and confirmed CI returned to green.
- **Result**: PASSED. Automated testing stopped the pipeline immediately upon test failure.

### Experiment 3 — Intentional lint violation
- **Objective**: Verify that static code analysis catches formatting and unused variable violations before tests or builds run.
- **Action**: Introduced an unused variable in `apps/api/src/server.js`:
  ```javascript
  const intentionalUnusedVariable = "trigger-lint-failure";
  ```
  Committed and pushed to `feat/ci-pipeline`.
- **Observed Workflow Run**: [Run #3 (ID: 41435896373)](https://github.com/Amar1432/blog-devops-app/actions/runs/41435896373)
  - **Commit**: `bdcdbb405021e15fa4d55b854a8b8ec0104270b2`
  - **Backend CI**: `completed`, `conclusion: failure`.
    - Failing step: `Run backend lint` failed with ESLint error:
      ```
      apps/api/src/server.js: 5:7 error 'intentionalUnusedVariable' is assigned a value but never used no-unused-vars
      ```
    - Short-circuit behavior: Subsequent steps (`Configure test environment`, `Apply Prisma migrations`, `Run backend tests`) were skipped.
  - **Frontend CI**: `completed`, `conclusion: success`.
  - **Docker Build Validation**: `completed`, `conclusion: success`.
- **Recovery**: Removed the unused variable and confirmed lint passed.
- **Result**: PASSED. ESLint violation immediately halted the backend job.

### Experiment 4 — Intentional frontend build error
- **Objective**: Verify that broken bundling or rollup module resolution errors are caught during the production build step.
- **Action**: In `apps/web/vite.config.js`, configured an invalid entry rollup option:
  ```javascript
  build: {
    rollupOptions: {
      input: "nonexistent-entry-file.html",
    },
  },
  ```
  This isolated the build step: `Run frontend lint` passed and `Run frontend tests` passed, while `Run frontend production build` failed. Committed and pushed to `feat/ci-pipeline`.
- **Observed Workflow Run**: [Run #5 (ID: 41436364934)](https://github.com/Amar1432/blog-devops-app/actions/runs/41436364934)
  - **Commit**: `b5969d3e52ad14d6e902b4e877e8cf59eec1e550`
  - **Frontend CI**: `completed`, `conclusion: failure`.
    - `Run frontend lint`: `completed`, `conclusion: success`.
    - `Run frontend tests`: `completed`, `conclusion: success`.
    - `Run frontend production build`: `completed`, `conclusion: failure` with:
      ```
      error during build:
      Could not resolve entry module "nonexistent-entry-file.html".
      ```
  - **Backend CI**: `completed`, `conclusion: success`.
  - **Docker Build Validation**: `completed`, `conclusion: success`.
- **Recovery**: Restored clean `vite.config.js` in commit `8e3d61a069df8b71d6f51c7a82ecaa17d1222849`.
- **Result**: PASSED. Frontend build failures halt CI and prevent deployment of broken static bundles.

### Experiment 5 — Docker build validation
- **Objective**: Verify that multi-stage Docker builds succeed for both services in CI without pushing images to an external registry.
- **Action**: Observed the `Docker Build Validation` job across all workflow runs:
  - Run ID `41435357587` (PR #1 initial)
  - Run ID `41436516435` (PR #1 clean restored)
  - Run ID `41436768710` (main branch merge)
- **Observed Steps**:
  1. `Build backend Docker image`: Executed `docker build -f apps/api/Dockerfile -t devops-blog-api:ci .` against root context, installed node dependencies, generated Prisma client, and built the unprivileged runtime container (`~40s`).
  2. `Build frontend Docker image`: Executed `docker build -f apps/web/Dockerfile -t devops-blog-web:ci .`, built the Vite static assets, and copied them to the `nginx:1.27-alpine` runtime container (`~20s`).
  3. No push commands were executed; runner images were discarded upon job completion.
- **Result**: PASSED. Both Dockerfiles build cleanly in isolated runners from the repository root.

### Experiment 6 — Pull request status checks & main branch push
- **Objective**: Verify that CI status checks appear on the GitHub pull request UI and that merging into `main` automatically runs verification on the mainline branch.
- **Action**:
  1. Opened Pull Request #1 from `feat/ci-pipeline` targeting `main`.
  2. Verified checks on commit `8e3d61a` in Run ID `41436516435`:
     - `Backend CI` — Successful
     - `Frontend CI` — Successful
     - `Docker Build Validation` — Successful
  3. Merged Pull Request #1 into `main` (Merge commit `5e52c5e162139d15c392d52187507b971a8cb32f`).
  4. Monitored the automatic `push` workflow run triggered on `main`:
     - **Workflow Run**: [Run #7 (ID: 41436768710)](https://github.com/Amar1432/blog-devops-app/actions/runs/41436768710)
     - **Event**: `push` on `refs/heads/main`
     - **Backend CI**: `completed`, `conclusion: success`
     - **Frontend CI**: `completed`, `conclusion: success`
     - **Docker Build Validation**: `completed`, `conclusion: success`
- **Result**: PASSED. Both pull request validation and mainline push execution are active and green.

---

## 10. Scope and intentional exclusions

The following features belong to later milestones and are intentionally omitted:
- **Image publishing**: Pushing images to GitHub Container Registry (GHCR) or Docker Hub.
- **Continuous Deployment (CD)**: Automated deployment to VPS, Coolify, or Kubernetes.
- **Production secrets**: Injecting production database or cloud provider tokens.
- **Release management**: Automated Git tagging, semantic versioning, or changelog generation.
