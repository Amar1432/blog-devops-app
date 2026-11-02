# Testing Guide

The backend uses **Jest** as the runner and **Supertest** for HTTP-level tests. Tests run against a dedicated PostgreSQL database and never touch development data.

## Test stack

| Tool       | Purpose                                        |
| ---------- | ---------------------------------------------- |
| Jest 30    | Runner, assertions, mocks, coverage            |
| Supertest  | In-process HTTP requests against the Express app |
| Prisma     | Real database access for integration and E2E   |
| bcryptjs   | Fast test password hashing (4 rounds)          |

ES modules are executed through Jest's `--experimental-vm-modules` flag, enabled by the npm scripts.

## One-time setup

```bash
# 1. Create the dedicated test database
createdb devops_blog_test

# 2. Create the test environment file
cp apps/api/.env.test.example apps/api/.env.test
# edit DATABASE_URL if your PostgreSQL user/password differ
```

`apps/api/.env.test` is Git-ignored. The committed `.env.test.example` documents every variable.

The Jest `globalSetup` hook runs `prisma migrate deploy` against the test database before the suite starts, so migrations are always current.

## Safety rules

Two guards prevent accidental data loss:

1. **Global setup** refuses to run unless the `DATABASE_URL` database name ends in `_test`.
2. **Every DB helper** (`resetDatabase`, `createTestAdmin`) re-checks the same condition before writing.

The suite resets only the `Post` and `User` tables. It never drops the database.

## Commands

Run from the repository root (or from `apps/api`):

| Command                       | Scope                                           |
| ----------------------------- | ----------------------------------------------- |
| `npm test`                    | All backend tests                               |
| `npm run test:unit`           | Pure functions and validators                   |
| `npm run test:component`      | Middleware in isolation                         |
| `npm run test:integration`    | Controllers against the real test database      |
| `npm run test:api`            | HTTP contract via Supertest                     |
| `npm run test:e2e`            | Full blog lifecycle through the public API      |
| `npm run test:watch`          | Re-run affected tests while developing          |
| `npm run test:coverage`       | Full suite with a coverage report               |

## Test layers

```
apps/api/tests/
├── config/
│   ├── globalSetup.js        # migrates the test DB, enforces *_test
│   └── setupEnv.js           # loads .env.test before app imports
├── helpers/
│   ├── db.js                 # reset + admin factory + Prisma export
│   └── auth.js               # Supertest login/token helpers
├── unit/                     # no I/O
│   ├── slug.test.js          # slugify + collision handling
│   ├── validators.test.js    # Zod schemas
│   └── AppError.test.js      # error helpers
├── component/                # isolated middleware
│   ├── authMiddleware.test.js
│   ├── validateMiddleware.test.js
│   └── errorHandler.test.js
├── integration/              # controller + real PostgreSQL
│   ├── authController.test.js
│   └── postController.test.js
├── api/                      # route + middleware + DB over HTTP
│   ├── health.api.test.js
│   ├── auth.api.test.js
│   └── posts.api.test.js
└── e2e/
    └── blog.e2e.test.js      # complete user journey
```

### Unit tests

Exercise pure logic with no database or HTTP:

- slug generation, accent removal, truncation, collision suffixes
- login/create/update validation rules
- `AppError` factory helpers

### Component tests

Exercise middleware with mocked `req`, `res` and `next`:

- missing, malformed, expired, wrongly-signed and valid JWTs
- Zod parsing, body replacement and 422 forwarding
- error serialization for `AppError`, Prisma `P2002`/`P2025`, bad JSON and unknown errors
- unknown-route handling

### Integration tests

Call controllers directly while using the real test database:

- login success, wrong password, unknown email, case normalization
- `/auth/me` for existing and deleted users
- create draft/published posts, slug de-duplication, explicit conflicts
- published-only filtering and ordering
- publish/unpublish timestamp semantics
- update, delete, admin listing and detail reads
- not-found paths

### API tests

Use Supertest against the exported Express app, covering the full HTTP stack:

- status codes and error envelopes (`400`, `401`, `404`, `409`, `422`)
- authentication enforcement on every protected route
- validation details
- draft privacy and published visibility
- duplicate slug conflicts
- CORS header for an allowed origin
- health endpoint success and database-down (`503`) behavior

### End-to-end tests

One realistic journey and one authorization boundary:

1. Health check and login.
2. Create a draft.
3. Confirm the draft is invisible publicly.
4. Publish and read it anonymously.
5. Edit title/content while keeping the slug stable.
6. Unpublish and confirm it disappears from public routes.
7. Republish and confirm `publishedAt` is preserved.
8. Delete and confirm all reads return 404.
9. Confirm anonymous users cannot create, edit or delete.

## Isolation and determinism

- `maxWorkers: 1` keeps database operations serial and deterministic.
- `resetDatabase()` runs before every test that uses the database.
- Each test creates its own admin with a known password.
- No test depends on execution order or on data from another test.
- Tests run in-process; no live API server or network port is required for Supertest.

## Coverage

`npm run test:coverage` currently reports:

```
All files   96.55% statements   92.95% branches   96.42% functions   96.47% lines
```

`src/server.js` is excluded because it only boots the HTTP listener. The environment-validation failure branch in `src/config/env.js` is also not exercised, since it terminates the process by design.

## Adding tests

1. Choose the lowest layer that can prove the behavior (unit before integration).
2. Import database helpers from `tests/helpers/db.js`; never create a Prisma client directly.
3. Call `resetDatabase()` in `beforeEach` for any test that writes data.
4. Disconnect Prisma in `afterAll` for files that use the database.
5. Prefer asserting observable behavior (status, payload, persisted state) over implementation details.

## Not covered yet

- React component and UI browser tests.
- Load, performance and security-specific tests.
- Deployment, Docker and CI execution (future milestones).
