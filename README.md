# DevOps Blog

A small full-stack blogging application built as the foundation for a hands-on DevOps learning journey. Milestone 0–1 delivers a working blog with a public reading experience and a JWT-protected admin area.

## Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Frontend  | React 18 + Vite (JavaScript)            |
| Backend   | Node.js + Express (ES modules)          |
| Database  | PostgreSQL                              |
| ORM       | Prisma (schema + migrations)            |
| Auth      | JWT (Bearer tokens), bcrypt passwords   |
| Validation| Zod                                     |

## Monorepo layout

```
.
├── apps
│   ├── api                 # Express REST API
│   │   ├── prisma          # schema, migrations, seed script
│   │   └── src
│   │       ├── config      # environment configuration
│   │       ├── controllers # request handlers
│   │       ├── lib         # Prisma client
│   │       ├── middleware  # auth, validation, errors
│   │       ├── routes      # Express routers
│   │       ├── utils       # AppError, slug helpers
│   │       └── validators  # Zod schemas
│   └── web                 # React + Vite SPA
│       └── src
│           ├── components
│           ├── lib         # API client, auth storage, formatting
│           └── pages
├── docs
│   ├── API.md
│   ├── DEVELOPMENT.md
│   ├── IMPLEMENTATION-PROMPT.md
│   └── MILESTONE-0-1-SPEC.md
├── package.json            # npm workspaces + root scripts
└── .gitignore
```

## Features (Milestone 0–1)

- Public post list and post detail pages (published posts only).
- Admin login with a seeded account; no public registration.
- JWT-protected admin dashboard.
- Create, edit, publish/unpublish and delete posts.
- Automatic, collision-safe slug generation.
- Request validation with Zod and consistent JSON error responses.
- Health endpoint that checks database connectivity.
- Prisma migrations and an idempotent admin seed script.
- Automated backend tests (unit, component, integration, API and end-to-end) with Jest and Supertest.

## Quick start

### Prerequisites

- Node.js 20 or newer (developed on Node 22)
- npm 10 or newer
- PostgreSQL 14 or newer running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
createdb devops_blog
```

### 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/api/.env` and set:

- `DATABASE_URL` for your PostgreSQL user
- `JWT_SECRET` to a long random value
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the seeded admin

`apps/web/.env` defaults to `VITE_API_URL=http://localhost:4000/api`.

### 4. Apply migrations and seed the admin

```bash
npm run db:migrate
npm run db:seed
```

### 5. Run the application

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

Log in at `/login` with the admin credentials from `apps/api/.env`.

### 6. Run the backend tests

```bash
createdb devops_blog_test
cp apps/api/.env.test.example apps/api/.env.test
# edit the DATABASE_URL in apps/api/.env.test if needed
npm test
```

The suite refuses to run against any database whose name does not end in `_test`.

## Root scripts

| Script               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Run API and web dev servers together             |
| `npm run dev:api`    | Run only the API (Node `--watch`)                |
| `npm run dev:web`    | Run only the Vite dev server                     |
| `npm run build`      | Build the frontend for production                |
| `npm start`          | Start the API without the watcher                |
| `npm run db:migrate` | Create/apply a development Prisma migration      |
| `npm run db:deploy`  | Apply existing migrations (no prompts)           |
| `npm run db:seed`    | Create/update the admin user                     |
| `npm run db:studio`  | Open Prisma Studio                               |
| `npm run db:generate`| Regenerate the Prisma client                     |
| `npm test`           | Run the full backend test suite                  |
| `npm run test:unit`  | Run unit tests                                   |
| `npm run test:component` | Run middleware/component tests               |
| `npm run test:integration` | Run controller + database tests            |
| `npm run test:api`   | Run HTTP API tests                               |
| `npm run test:e2e`   | Run end-to-end lifecycle tests                   |
| `npm run test:coverage` | Run all tests with coverage                   |

## Documentation

- [Development guide](docs/DEVELOPMENT.md) — setup, scripts, migrations, troubleshooting.
- [Testing guide](docs/TESTING.md) — test layers, database setup, coverage.
- [API reference](docs/API.md) — endpoints, payloads, error format.

## Scope

Milestone 0–1 intentionally excludes Docker, CI/CD, Kubernetes, cloud infrastructure, Coolify, Redis, microservices, image uploads, comments, likes, public registration and complex role management. Those belong to later milestones.

## Known limitations

- Post content is plain text rendered with preserved whitespace; there is no Markdown editor.
- The post list is not paginated.
- There is a single admin role; every authenticated user has full access.
- `npm audit` reports **development-only** advisories (Prisma CLI and Jest tooling). They are not part of the running application; upgrading to Prisma 7 would resolve the Prisma one but is deferred to keep this milestone simple.
- Automated tests cover the backend only; React UI tests are not included yet.
