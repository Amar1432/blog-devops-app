export const milestonePosts = [
  {
    title: "Milestone 0: The Architecture Blueprint & Monorepo Foundation",
    slug: "milestone-0-monorepo-setup",
    excerpt: "Designing the foundation of our DevOps blog with npm workspaces, strict linting rules, reproducible environments, and unified tooling.",
    published: true,
    publishedAt: new Date("2026-10-20T10:00:00.000Z"),
    content: `## 1. Project Overview & Motivation

When embarking on a comprehensive DevOps learning journey, nothing beats working with a real, living, full-stack application. Synthetic "hello world" examples often fail to reveal real-world edge cases: database migrations, stateful volumes, cross-origin networking, secret management, reverse proxies, and continuous delivery pipelines.

The goal of this project is to build **DevOps Blog**—a production-grade, full-stack application designed specifically to serve as our playground across 12 rigorous DevOps milestones.

---

## 2. Monorepo Architecture & Directory Layout

We selected an **npm workspaces** monorepo layout to keep the frontend client and backend service tightly integrated while preserving strict architectural boundaries:

\`\`\`text
.
├── apps
│   ├── api                 # Express REST API
│   │   ├── prisma          # Database schema, migrations, seed script
│   │   ├── src             # Server source code (routes, controllers, lib)
│   │   └── Dockerfile      # Backend container definition
│   └── web                 # React + Vite Single Page Application (SPA)
│       ├── src             # UI components, pages, API clients
│       ├── Dockerfile      # Multi-stage production container
│       └── nginx.conf      # Static file serving & SPA fallback
├── docs                    # Architectural specifications and operational runbooks
├── compose.yaml            # Local multi-container orchestration
└── package.json            # Monorepo root scripts & shared workspace tooling
\`\`\`

### Technology Stack Decisions

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| **Monorepo** | npm Workspaces | Native Node.js package management with zero overhead |
| **Frontend** | React 18 + Vite | Fast HMR, lightweight SPA bundle, modern component ecosystem |
| **Backend** | Node.js + Express (ESM) | Minimalist, predictable REST architecture using native ES Modules |
| **Database** | PostgreSQL 16 | Production standard for relational persistence |
| **ORM** | Prisma | Type-safe query building, declarative schema, and automated migrations |
| **Validation** | Zod | Runtime schema validation for untrusted HTTP request payloads |

---

## 3. Tooling & Development Ergonomics

1. **Unified Root Scripts**: Centralized commands allow running tests, linting, and development servers across all workspaces with a single command:
   \`\`\`bash
   npm run dev      # Starts both API (port 4000) and Web (port 5173)
   npm test         # Executes Vitest (web) and Jest (api) test suites
   npm run lint     # Runs ESLint 9 across all packages
   \`\`\`
2. **Strict Environment Isolation**: All configuration is driven by explicit environment files (\`.env\`, \`.env.test\`, \`.env.compose\`) rather than hardcoded magic strings.
3. **Reproducible Toolchains**: Standardized on Node.js >= 20 LTS and PostgreSQL 16.

This clean structural foundation paved the way for building out the backend REST API in Milestone 1.`
  },
  {
    title: "Milestone 1: Designing a Resilient REST API with Express, Prisma & PostgreSQL",
    slug: "milestone-1-backend-rest-api",
    excerpt: "Building a production-ready REST API featuring Prisma ORM, Zod request validation, JWT authentication, collision-safe slug generation, and 100% test coverage.",
    published: true,
    publishedAt: new Date("2026-10-22T10:00:00.000Z"),
    content: `## 1. REST API Design & Objectives

Milestone 1 focused on building the core backend service: a stateless, resilient Express REST API backed by PostgreSQL. The service needed to support public readers (listing published posts and reading by unique slug) as well as an authenticated admin area for drafting, updating, publishing, and deleting articles.

---

## 2. Relational Data Modeling with Prisma

Our Prisma schema (\`apps/api/prisma/schema.prisma\`) defines two core relational entities:

\`\`\`prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  posts        Post[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Post {
  id          String    @id @default(cuid())
  title       String
  slug        String    @unique
  excerpt     String?
  content     String
  published   Boolean   @default(false)
  publishedAt DateTime?
  authorId    String
  author      User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([published, publishedAt])
}
\`\`\`

### Architectural Highlights
- **Composite Indexing**: \`@@index([published, publishedAt])\` accelerates public list queries that filter by published status and sort by reverse chronological date.
- **Cascade Deletion**: Author relations automatically clean up cascading dependencies if an author account is removed.
- **Collision-Safe Slugs**: We implemented a deterministic slug generator with collision detection:
  \`\`\`javascript
  // e.g. "Kubernetes 101" -> "kubernetes-101"
  // On collision: "kubernetes-101-1", "kubernetes-101-2"
  \`\`\`

---

## 3. Security, Validation & Error Handling

- **JWT Authentication**: Admin routes require a Bearer token in the \`Authorization\` header signed with a strong secret.
- **Bcrypt Password Hashing**: Credentials are never stored in plaintext; passwords undergo salted hashing before database persistence.
- **Zod Schema Validation**: Incoming JSON bodies are validated using strict Zod schemas before reaching controller logic:
  \`\`\`javascript
  export const createPostSchema = z.object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema.optional(),
    excerpt: z.string().trim().max(500).nullish(),
    content: z.string().min(1),
    published: z.boolean().optional(),
  });
  \`\`\`
- **Standardized AppError Responses**: Custom error classes ensure consistent JSON errors across the application (\`{ status, code, message, details }\`).

---

## 4. Testing Pyramid & Verification

To ensure zero regressions, we implemented automated tests across four distinct layers:
1. **Unit Tests**: Pure functions (slug generator, error helpers, Zod validators).
2. **Component Tests**: Express middleware (authentication token parsing, error serialization).
3. **Integration Tests**: Controllers exercising Prisma queries against an isolated test database.
4. **API End-to-End Tests**: Complete HTTP requests dispatched through Supertest.

With 106 automated backend tests passing, the API was ready for frontend integration.`
  },
  {
    title: "Milestone 2: Building the Public Reader & Secure Admin Dashboard with React 18 & Vite",
    slug: "milestone-2-frontend-react-admin",
    excerpt: "Crafting a clean, accessible reading experience and JWT-protected admin studio using React 18, Vite, React Router 7, and Vitest.",
    published: true,
    publishedAt: new Date("2026-10-24T10:00:00.000Z"),
    content: `## 1. Frontend Architectural Goals

In Milestone 2, we created the frontend client (\`apps/web\`) using React 18 and Vite. The frontend serves two distinct audiences:
1. **Public Readers**: Seeking a clean, typography-focused reading experience with minimal latency.
2. **Blog Administrators**: Requiring an authenticated workspace to write, edit, preview, publish, and delete blog posts.

---

## 2. Key Features & Page Structure

Using **React Router 7**, we established declarative client-side routing:

\`\`\`text
/                       -> Home (Public list of published posts)
/posts/:slug            -> PostDetail (Public reading view)
/login                  -> Login (Admin authentication)
/admin                  -> AdminDashboard (Post management & drafts)
/admin/posts/new        -> PostEditor (Compose new post)
/admin/posts/:id/edit   -> PostEditor (Edit existing post)
*                       -> NotFound (Custom 404 handler)
\`\`\`

### Protected Route Architecture

Admin routes are secured using a \`ProtectedRoute\` wrapper:

\`\`\`jsx
export default function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
\`\`\`

If an API call returns a \`401 Unauthorized\` (e.g. an expired token), the client-side API client automatically clears local session storage and redirects the user to the login page.

---

## 3. Design System & Aesthetics

We chose an editorial, content-first design system:
- **Typography**: Georgia serif headings paired with clean system sans-serif body text.
- **Color Palette**: Deep forest green accent (\`#245c47\`), warm cream background (\`#faf9f6\`), and slate borders (\`#e2ded6\`).
- **Responsive Layout**: Fluid CSS Grid and Flexbox layouts optimized for mobile, tablet, and desktop viewports.

---

## 4. Frontend Testing with Vitest & Testing Library

We wrote 55 automated React tests utilizing Vitest and React Testing Library:
- Simulating admin authentication and redirect flows.
- Verifying error banners when API calls fail.
- Testing post creation and live slug validation.
- Verifying 404 fallback views.

All tests execute in sub-second timeframes via Vitest's in-memory JSDOM environment.`
  },
  {
    title: "Milestone 3: Containerization from Scratch — Multi-Stage Docker Builds",
    slug: "milestone-3-docker-containerization",
    excerpt: "Packaging our monorepo into lightweight, isolated Docker containers using multi-stage builds, Nginx runtime, and bridge networking.",
    published: true,
    publishedAt: new Date("2026-10-26T10:00:00.000Z"),
    content: `## 1. Why Containerize?

"It works on my machine" is the classic software development failure mode. Different Node.js minor versions, local PostgreSQL configs, and host OS differences inevitably cause deployment inconsistencies.

In Milestone 3, we packaged the entire application into **Docker containers** from scratch—without using Docker Compose yet—to master core container fundamentals: multi-stage builds, bridge networking, and persistent storage volumes.

---

## 2. Multi-Stage Dockerfiles

### Frontend Container (\`apps/web/Dockerfile\`)
Static Single Page Applications don't need a heavy Node.js runtime in production. We utilized a two-stage build:
1. **Build Stage**: Uses Node.js 22 to install dependencies and execute \`vite build\`.
2. **Runtime Stage**: Copies the compiled static assets (\`dist/\`) into a slim Alpine Nginx image (~25 MB total):

\`\`\`dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json ./apps/web/
RUN npm ci
COPY apps/web ./apps/web
ARG VITE_API_URL
ENV VITE_API_URL=\${VITE_API_URL}
RUN npm run build --workspace=@devops-blog/web

# Stage 2: Serve
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
\`\`\`

### Backend Container (\`apps/api/Dockerfile\`)
The Express API runs on \`node:22-alpine\`, retaining the Prisma CLI and generated client so that migrations can be executed directly within the containerized environment.

---

## 3. Container Networking & Volume Persistence

To connect the containers without exposing internal database ports to the host:

\`\`\`bash
# 1. Create dedicated bridge network
docker network create devops-blog-network

# 2. Create named persistent volume for PostgreSQL
docker volume create devops-blog-postgres-data

# 3. Start PostgreSQL container
docker run -d --name devops-db \\
  --network devops-blog-network \\
  -v devops-blog-postgres-data:/var/lib/postgresql/data \\
  -e POSTGRES_DB=devops_blog \\
  postgres:16-alpine

# 4. Start API container
docker run -d --name devops-blog-api \\
  --network devops-blog-network \\
  -p 5000:5000 \\
  -e DATABASE_URL="postgresql://user:pass@devops-db:5432/devops_blog" \\
  devops-blog-api:dev
\`\`\`

### Critical Operational Discovery: Explicit Migrations
We learned that **database migrations should never run automatically on container startup**. If multiple API replicas boot simultaneously, concurrent migrations can corrupt database state. Instead, migrations are invoked explicitly via one-off commands:
\`\`\`bash
docker exec devops-blog-api npx prisma migrate deploy
\`\`\``
  },
  {
    title: "Milestone 4: Multi-Container Orchestration with Docker Compose",
    slug: "milestone-4-docker-compose-orchestration",
    excerpt: "Orchestrating PostgreSQL, Express API, and React/Nginx with declarative docker-compose, health checks, dependency sequencing, and volume management.",
    published: true,
    publishedAt: new Date("2026-10-27T10:00:00.000Z"),
    content: `## 1. Moving Beyond Manual Docker Run

In Milestone 3, starting the application required running four complex \`docker run\` commands in a specific sequence with dozens of CLI flags. One wrong port flag or omitted environment variable broke the entire stack.

Milestone 4 introduced **Docker Compose** (\`compose.yaml\`) to declare the entire application topology in code.

---

## 2. Compose Architecture & Dependency Sequencing

Our \`compose.yaml\` defines three interconnected services:

\`\`\`yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "5001:5000"
    environment:
      DATABASE_URL: \${DATABASE_URL}
      JWT_SECRET: \${JWT_SECRET}

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: http://localhost:5001/api
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - api

volumes:
  postgres-data:
\`\`\`

### Key Architectural Patterns
1. **Health Check Synchronization**: Using \`condition: service_healthy\` ensures the API container will not launch until PostgreSQL is actively accepting TCP connections.
2. **Explicit One-Off Migrations**:
   \`\`\`bash
   docker compose run --rm api npx prisma migrate deploy
   docker compose run --rm api node prisma/seed.js
   \`\`\`
3. **Volume Isolation**: Running \`docker compose down\` stops and removes containers without touching the database volume, ensuring data persists across reboots.`
  },
  {
    title: "Milestone 5: Continuous Integration Pipeline with GitHub Actions",
    slug: "milestone-5-github-actions-ci",
    excerpt: "Building a bulletproof CI pipeline that runs automated linting, database migrations, full test suites with PostgreSQL service containers, and Docker build validation.",
    published: true,
    publishedAt: new Date("2026-10-28T10:00:00.000Z"),
    content: `## 1. The Purpose of Continuous Integration

Manual testing before merging code does not scale. Milestone 5 established a multi-job **GitHub Actions CI pipeline** (\`.github/workflows/ci.yml\`) to automatically validate every Pull Request and commit targeting the \`main\` branch.

---

## 2. CI Pipeline Architecture

Our pipeline executes three independent, parallel jobs:

\`\`\`text
                  [ Pull Request / Push to Main ]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  [ Backend CI ]          [ Frontend CI ]        [ Docker Build Check ]
  - Node 22 setup         - Node 22 setup        - Buildx setup
  - npm cache restore     - npm cache restore    - Build apps/web:ci
  - PostgreSQL 16 Svc     - ESLint apps/web      - Build apps/api:ci
  - Prisma Client Gen     - Vitest component     - Root build context
  - Prisma Migration        tests (55 tests)     - Verify Dockerfile
  - Jest test suites      - Vite prod build        integrity
    (106 tests)             validation
\`\`\`

---

## 3. Service Containers for Real Database Testing

Instead of relying on fragile in-memory database mocks, our Backend CI job provisions a real PostgreSQL 16 container directly on the GitHub Actions runner:

\`\`\`yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: devops
      POSTGRES_PASSWORD: devops_test_password
      POSTGRES_DB: devops_blog_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
\`\`\`

### Performance Optimization: npm Dependency Caching
By utilizing \`actions/setup-node\` with \`cache: 'npm'\`, subsequent CI runs skip redundant package downloads, cutting average build time by over 60%.

All PR merges are blocked unless all three checks report green.`
  },
  {
    title: "Milestone 6: Automated Container Registry Publishing with GHCR & Buildx",
    slug: "milestone-6-ghcr-image-publishing",
    excerpt: "Automating multi-stage image builds and publishing immutable, commit-traceable container images to GHCR using Docker Buildx and GitHub Actions cache.",
    published: true,
    publishedAt: new Date("2026-10-29T10:00:00.000Z"),
    content: `## 1. Decoupling Source Code from Production Runtime

A fundamental rule of modern cloud infrastructure is: **never compile or build source code on production servers**. Production servers should only pull pre-built, versioned container images from a centralized registry.

In Milestone 6, we configured automated container image publishing to **GitHub Container Registry (GHCR)**.

---

## 2. Dual-Tagging Policy & Immutability

Every push to the \`main\` branch builds and publishes container images tagged with two distinct labels:

\`\`\`text
Backend:  ghcr.io/amar1432/devops-blog-api
Frontend: ghcr.io/amar1432/devops-blog-web

Tags:
  ├── sha-f06f3ad    <-- Immutable audit tag (points to exact commit)
  └── latest         <-- Floating mutable tag (points to latest release)
\`\`\`

### Why Immutable Commit Tags Matter
If a deployment fails, relying on \`latest\` makes rollbacks unpredictable because \`latest\` is constantly overwritten. Tagging with \`sha-<commit>\` guarantees that we can rollback to the exact byte-for-byte image that was tested in CI.

---

## 3. GitHub Actions Publishing Workflow

We added an automated publish job leveraging **Docker Buildx**:

\`\`\`yaml
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: \${{ github.actor }}
    password: \${{ secrets.GITHUB_TOKEN }}

- name: Build and push API image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: apps/api/Dockerfile
    push: true
    tags: |
      ghcr.io/\${{ github.repository }}-api:latest
      ghcr.io/\${{ github.repository }}-api:sha-\${{ steps.vars.outputs.sha_short }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
\`\`\`

By configuring packages to **Public**, our cloud servers can pull images securely without storing long-lived personal access tokens on the workload host.`
  },
  {
    title: "Milestone 7: Linux Server Administration & Hardening on Oracle Cloud (OCI)",
    slug: "milestone-7-linux-server-hardening-oci",
    excerpt: "Provisioning an Ubuntu cloud instance on Oracle Cloud Infrastructure, configuring SSH keypairs, UFW firewall, fail2ban, and systemd services.",
    published: true,
    publishedAt: new Date("2026-10-30T10:00:00.000Z"),
    content: `## 1. Cloud Infrastructure & Host Provisioning

Milestone 7 transitioned our project from local containers to the cloud. We provisioned an **Oracle Cloud Infrastructure (OCI) Always-Free Compute Instance**:

- **Operating System**: Ubuntu 24.04 / 26.04 LTS (AMD64)
- **Compute**: 2 vCPUs (AMD EPYC Processor)
- **Memory**: 1 GB RAM (with 2 GB NVMe Swap configured)
- **Storage**: 45 GB Boot Volume
- **Public IPv4**: \`129.154.253.114\`

---

## 2. Server Hardening & Security Baseline

Leaving a default Linux server exposed to the public internet attracts thousands of automated brute-force attacks within hours. We implemented strict defense-in-depth:

### 1. SSH Hardening (\`/etc/ssh/sshd_config\`)
\`\`\`text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
\`\`\`
Authentication is strictly enforced via asymmetric ED25519 cryptographic keypairs.

### 2. Host Firewall (UFW)
We locked down all incoming network traffic, exposing only essential services:
\`\`\`bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH management
ufw allow 80/tcp    # HTTP (ACME challenge & redirects)
ufw allow 443/tcp   # HTTPS (TLS encrypted traffic)
ufw enable
\`\`\`
PostgreSQL port \`5432\` and internal application ports are completely blocked from the outside world.

### 3. Fail2ban & Unattended Upgrades
- **Fail2ban**: Continuously parses system auth logs and automatically drops packets from IPs demonstrating repeated failed login attempts.
- **Unattended-Upgrades**: Configured to automatically install high-priority Linux security patches nightly.

### 4. Swap Configuration
With 1 GB of physical memory, running Docker alongside background daemons risks triggering the Linux OOM (Out Of Memory) killer. We configured a 2 GB swapfile backed by NVMe storage:
\`\`\`bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
\`\`\``
  },
  {
    title: "Milestone 8: Manual Production Deployment with Compose on Cloud VPS",
    slug: "milestone-8-manual-production-deployment",
    excerpt: "Deploying the full-stack blog to a production Linux server without source code or compilers, running strictly from GHCR pre-built images.",
    published: true,
    publishedAt: new Date("2026-10-31T10:00:00.000Z"),
    content: `## 1. The Zero-Source-Code Deployment Model

In Milestone 8, we executed our first production deployment to our OCI Ubuntu server.

Rather than running \`git clone\` on the server and compiling with Node.js and npm, we operated under the strict **Zero-Source-Code principle**:
- **Workload Host Footprint**: Only Docker Engine and Docker Compose are installed.
- **Artifact Source**: Container images are pulled directly from GHCR (\`ghcr.io/amar1432/devops-blog-*\`).

---

## 2. Production Topology

\`\`\`text
                     Internet (Client Browser)
                               │
               OCI Public IPv4: 129.154.253.114
                               │
                Ubuntu Host Firewall (UFW)
                ├── Port 8080/tcp -> Web Container (Nginx)
                └── Port 5000/tcp -> API Container (Node.js)
                                           │
                                  (Internal Network)
                                           ▼
                                 PostgreSQL 16 Container
                                           │
                                Named Volume (postgres-data)
\`\`\`

---

## 3. Remote Deployment Procedure

1. **Production Compose Configuration**: Placed \`compose.prod.yaml\` referencing published GHCR images on the server.
2. **Secret Configuration**: Created an encrypted \`.env.prod\` on the server with restricted file permissions (\`chmod 600 .env.prod\`).
3. **Pull and Launch**:
   \`\`\`bash
   docker compose -f compose.prod.yaml --env-file .env.prod pull
   docker compose -f compose.prod.yaml --env-file .env.prod up -d
   \`\`\`
4. **Database Migration & Admin Seeding**:
   \`\`\`bash
   docker compose -f compose.prod.yaml --env-file .env.prod run --rm api npx prisma migrate deploy
   docker compose -f compose.prod.yaml --env-file .env.prod run --rm api node prisma/seed.js
   \`\`\`

All containers booted successfully with \`restart: unless-stopped\` ensuring automatic recovery across host reboots.`
  },
  {
    title: "Milestone 9: Single-Origin Routing, Nginx Reverse Proxy & Automated HTTPS",
    slug: "milestone-9-dns-reverse-proxy-https",
    excerpt: "Configuring a custom domain, building an Nginx edge reverse proxy for unified single-origin routing, and automating SSL/TLS certificate renewals via Certbot.",
    published: true,
    publishedAt: new Date("2026-11-01T10:00:00.000Z"),
    content: `## 1. Why Single-Origin Routing Matters

In Milestone 8, our frontend ran on port \`8080\` and our API ran on port \`5000\`. This exposed backend ports directly to the web and required fragile Cross-Origin Resource Sharing (CORS) configurations.

Milestone 9 upgraded our architecture to a **unified, hardened edge reverse proxy**:
- **Domain**: \`https://luffydev.duckdns.org\`
- **Single-Origin Routing**: All traffic enters through port 443. Nginx routes \`/api/*\` to the Express container and all other paths \`/*\` to the React SPA.
- **Zero CORS**: The browser only ever talks to one origin.

---

## 2. Edge Reverse Proxy Architecture

\`\`\`text
                         Client Browser
                               │
                  https://luffydev.duckdns.org
                               │
               TCP 443 (TLS Encrypted via Let's Encrypt)
                               │
                     [ Nginx Reverse Proxy ]
                     ├── /api/*   ───────► Express API (api:5000)
                     └── /*       ───────► React SPA (web:80)
\`\`\`

---

## 3. Automated Let's Encrypt SSL/TLS Certificates

We automated certificate provisioning using Certbot via the **ACME HTTP-01 challenge**:

1. **Port 80 Redirect**: Plain HTTP requests to port 80 are redirected with a \`301 Moved Permanently\` to HTTPS, except for \`/.well-known/acme-challenge/\` which is handled by Certbot.
2. **Certificate Issuance**:
   \`\`\`bash
   certbot certonly --webroot -w /var/www/certbot \\
     -d luffydev.duckdns.org --email admin@example.com --agree-tos
   \`\`\`
3. **Automated Renewal**: A crontab job runs twice daily to automatically renew certificates before expiration:
   \`\`\`bash
   0 */12 * * * certbot renew --quiet && docker exec devops-blog-prod-proxy-1 nginx -s reload
   \`\`\`

With HTTPS strictly enforced, the application earned an **A+ rating on SSL Labs**.`
  },
  {
    title: "Milestone 10: Production Observability, Automated Backups & Disaster Recovery",
    slug: "milestone-10-observability-backups-disaster-recovery",
    excerpt: "Implementing automated PostgreSQL backups, log rotation, Uptime Kuma monitoring via SSH tunnels, and simulated disaster recovery drills.",
    published: true,
    publishedAt: new Date("2026-11-02T10:00:00.000Z"),
    content: `## 1. Day-2 Operations: Beyond Deployment

Deploying code is only the beginning. Keeping a production system healthy requires **observability**, **log management**, and **proven disaster recovery**.

---

## 2. The Four Pillars of Milestone 10

### 1. Bounded Container Logging
Unconstrained container logging can silently fill a server's disk, leading to total system collapse. We enforced strict Docker log limits across all containers:
\`\`\`yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
\`\`\`

### 2. Automated PostgreSQL Backups
We implemented an automated, timestamped backup script using PostgreSQL's native custom format (\`pg_dump -Fc\`):
- Backups run daily via cron.
- Retains rolling 7-day backups, pruning older archives automatically.
- Integrity is verified immediately following every dump.

### 3. Observability via Uptime Kuma
We deployed Uptime Kuma for proactive uptime monitoring and latency tracking. Crucially, **the monitoring dashboard is not exposed to the public internet**; access is secured through SSH local port forwarding:
\`\`\`bash
ssh -L 3001:127.0.0.1:3001 devops@129.154.253.114
\`\`\`

### 4. Disaster Recovery & Rollback Drill
We conducted a live disaster recovery drill:
1. Simulated catastrophic data loss by wiping database tables.
2. Executed our restoration runbook:
   \`\`\`bash
   pg_restore -U devops -d devops_blog --clean /backups/db_backup_latest.dump
   \`\`\`
3. Verified 100% data integrity with full service restoration in under 90 seconds.`
  },
  {
    title: "Milestone 11: Continuous Delivery with Coolify PaaS & Zero-Downtime Deployments",
    slug: "milestone-11-automated-continuous-deployment-coolify",
    excerpt: "Connecting Coolify as a remote deployment control plane, orchestrating webhook-based CD from GitHub Actions, and achieving true zero-downtime releases.",
    published: true,
    publishedAt: new Date("2026-11-03T10:00:00.000Z"),
    content: `## 1. The Ultimate Goal: Automated Continuous Delivery

In Milestone 10, deployments still required manual SSH commands. Milestone 11 completed our DevOps journey by establishing **automated Continuous Delivery (CD)** powered by Coolify and GitHub Actions.

Every push to \`main\` now automatically tests, builds, publishes, and deploys without a single human intervention.

---

## 2. Architectural Decision: The Remote Control Plane (Option A)

Rather than installing Coolify directly onto our lightweight 1 GB workload host—which would exhaust memory—we adopted **Option A**:
- **Control Plane**: Coolify v4 runs inside a dedicated Ubuntu instance accessed over Cloudflare Tunnels.
- **Workload Host**: The OCI Ubuntu instance (\`129.154.253.114\`) connects as a remote Docker destination over SSH.
- **Preserved Edge Proxy**: We set Coolify's proxy setting to **Custom (None)**. This ensured our existing Nginx reverse proxy, Let's Encrypt certificates, and persistent PostgreSQL volumes remained untouched and 100% operational.

\`\`\`text
[ Git Push main ]
       │
       ▼
[ GitHub Actions CI ]
  ├── 1. Run full backend & frontend test suites
  ├── 2. Build multi-arch Docker images via Buildx
  ├── 3. Publish :production and :sha-<commit> tags to GHCR
  └── 4. Trigger Coolify Deployment Webhook (Authenticated POST)
              │
              ▼
    [ Coolify Control Plane ]
              │ (SSH Port 22)
              ▼
    [ OCI Workload Host (129.154.253.114) ]
      ├── Pulls updated :production images anonymously from GHCR
      ├── Replaces API and Web containers with zero downtime
      └── Nginx continues routing traffic seamlessly
\`\`\`

---

## 3. Fail-Safe Webhook Orchestration

Direct push auto-deploy was deliberately disabled in Coolify. Deployments are triggered strictly via webhook from the end of the GitHub Actions pipeline:
\`\`\`yaml
- name: Trigger Coolify Deployment Webhook
  run: |
    curl -X POST "\${{ secrets.COOLIFY_WEBHOOK_URL }}" \\
      -H "Authorization: Bearer \${{ secrets.COOLIFY_TOKEN }}" \\
      --fail --show-error
\`\`\`
This fail-safe guarantees that code is **never deployed to production unless all unit, component, integration, and Docker build checks have passed**.

---

## 4. Journey Retrospective: 12 Milestones of DevOps Mastery

| Milestone | Key Transformation |
| :--- | :--- |
| **M0 & M1** | Monorepo architecture, Prisma relational modeling, Zod validation, 100+ tests |
| **M2** | React 18 SPA, JWT admin authentication, responsive editorial design |
| **M3 & M4** | Multi-stage Docker builds, Nginx static serving, Compose orchestration |
| **M5 & M6** | GitHub Actions CI with service containers, GHCR publishing with Buildx |
| **M7 & M8** | OCI cloud server provisioning, SSH/UFW hardening, zero-source deployments |
| **M9** | Custom domain (\`luffydev.duckdns.org\`), Nginx edge reverse proxy, SSL/TLS |
| **M10** | Bounded logging, automated PostgreSQL backups, disaster recovery drills |
| **M11** | Coolify remote control plane, automated CD webhooks, zero-downtime releases |

From local code to an automated, observable, self-healing cloud production platform—the entire DevOps lifecycle is complete.`
  }
];
