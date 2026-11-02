# Development Guide

## Prerequisites

- Node.js >= 20 (Node 22 recommended)
- npm >= 10
- PostgreSQL >= 14 running locally
- `createdb` available on your `PATH` (ships with PostgreSQL)

## Initial setup

```bash
npm install
createdb devops_blog
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit both `.env` files. Never commit them — they are excluded by `.gitignore`.

### Backend environment variables (`apps/api/.env`)

| Variable         | Required | Default                 | Purpose                                   |
| ---------------- | -------- | ----------------------- | ----------------------------------------- |
| `DATABASE_URL`   | yes      | —                       | PostgreSQL connection string              |
| `JWT_SECRET`     | yes      | —                       | Signing secret (min 16 characters)        |
| `JWT_EXPIRES_IN` | no       | `1d`                    | Token lifetime                            |
| `PORT`           | no       | `4000`                  | API port                                  |
| `NODE_ENV`       | no       | `development`           | Environment mode                          |
| `CORS_ORIGIN`    | no       | `http://localhost:5173` | Comma-separated allowed origins           |
| `ADMIN_EMAIL`    | seed     | —                       | Seeded admin email                        |
| `ADMIN_PASSWORD` | seed     | —                       | Seeded admin password (min 8 characters)  |
| `ADMIN_NAME`     | no       | `Site Admin`            | Seeded admin display name                 |

### Frontend environment variables (`apps/web/.env`)

| Variable       | Default                     | Purpose            |
| -------------- | --------------------------- | ------------------ |
| `VITE_API_URL` | `http://localhost:4000/api` | Backend API base   |

Environment variables are validated at startup. The API exits with a readable error if required values are missing or malformed.

## Database workflow

```bash
npm run db:migrate     # create + apply a migration during development
npm run db:deploy      # apply committed migrations (CI/production-style)
npm run db:seed        # create or update the admin user
npm run db:studio      # inspect data in Prisma Studio
```

Migrations live in `apps/api/prisma/migrations/` and must be committed. After changing `schema.prisma`:

```bash
cd apps/api
npx prisma migrate dev --name describe_the_change
```

### Seed behavior

The seed script is idempotent: it upserts the user identified by `ADMIN_EMAIL`. Re-running it updates that user's name and password hash from the environment. This makes it safe to re-run after changing `ADMIN_PASSWORD`, but it also means **re-seeding resets the admin password**.

## Running the app

```bash
npm run dev        # API + web together
npm run dev:api    # API only, with Node --watch
npm run dev:web    # Vite only
```

The combined `dev` script starts both processes in the background of one shell. If your terminal does not stop both on `Ctrl+C`, stop them individually or use two terminals with `dev:api` and `dev:web`.

To run the API in a production-like way:

```bash
npm run build      # build web assets
npm start          # start API (no watcher)
```

## Project conventions

- JavaScript with ES modules (`"type": "module"`) everywhere.
- Backend layering: routes → middleware (auth/validation) → controllers → Prisma.
- All request bodies are validated with Zod before reaching controllers.
- Controllers use `try/catch` and forward errors with `next(error)`.
- Errors are normalized to:

  ```json
  { "error": { "code": "CODE", "message": "Human readable", "details": {} } }
  ```

- Public endpoints only expose published posts. Drafts require a valid JWT.
- Slugs are lowercase alphanumeric segments separated by single hyphens. Generated slugs are automatically de-duplicated (`my-post`, `my-post-2`, ...); an explicitly supplied duplicate slug returns `409 Conflict`.
- Publishing an unpublished post sets `publishedAt` the first time. Unpublishing keeps the original timestamp.

## Automated tests

The backend has a Jest + Supertest suite using a dedicated test database. See [TESTING.md](TESTING.md) for the full guide.

```bash
createdb devops_blog_test
cp apps/api/.env.test.example apps/api/.env.test
# edit DATABASE_URL in apps/api/.env.test
npm test
```

Available scopes: `test:unit`, `test:component`, `test:integration`, `test:api`, `test:e2e`, `test:coverage`, `test:watch`.

The suite applies pending migrations to the test database automatically and refuses to run against a database whose name does not end in `_test`. It is isolated from the development database and safe to run repeatedly.

## Verification checklist

For a manual smoke test, with PostgreSQL running, migrations applied and the seed executed:

```bash
# Health (200, database up)
curl -i http://localhost:4000/api/health

# Login (200 + token)
curl -i -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-please"}'

# Unauthorized create (401)
curl -i -X POST http://localhost:4000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"title":"x","content":"y"}'

# Validation failure (422)
curl -i -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email"}'
```

Then in the browser:

1. Visit `/` and confirm the empty state or published posts.
2. Log in at `/login`.
3. Create a draft, edit it, publish it.
4. Open `/posts/<slug>` and confirm the content renders.
5. Delete the post from `/admin` and confirm it disappears.
6. Log out and confirm `/admin` redirects to `/login`.

## Troubleshooting

| Symptom                                   | Fix                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `Connection refused` on port 5432         | Start PostgreSQL (`brew services start postgresql@14` on macOS).    |
| Prisma `P1001`                            | Database is unreachable; check `DATABASE_URL` and that the DB exists.|
| `JWT_SECRET must be at least 16 characters`| Set a longer secret in `apps/api/.env`.                             |
| `Port 4000 already in use`                | Stop the other process or change `PORT` (and `VITE_API_URL`).       |
| Browser requests blocked by CORS          | Add the web origin to `CORS_ORIGIN` and restart the API.            |
| Admin login fails after changing env      | Re-run `npm run db:seed` so the new password is hashed and stored.  |
| Prisma client out of date                 | Run `npm run db:generate`.                                          |

### Reset the database

```bash
dropdb devops_blog
createdb devops_blog
npm run db:deploy
npm run db:seed
```

### Git hygiene

- `.env` and `.env.*` are ignored; only `.env.example` files are tracked.
- Do not commit secrets, tokens or local database files.
