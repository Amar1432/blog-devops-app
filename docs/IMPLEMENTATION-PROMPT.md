# Implementation Task: DevOps Blog — Milestone 0 & 1

You are acting as a Senior Full Stack Engineer.

Your task is to implement the DevOps Blog application according to the Milestone 0–1 implementation specification.

## Primary objective

Build a simple, functional full-stack blogging application using:

- React + Vite + JavaScript
- Node.js + Express
- PostgreSQL
- Prisma ORM
- JWT authentication

This project is specifically intended for learning DevOps. Therefore, prioritize simplicity, readability, maintainability and predictable behavior over architectural sophistication.

## Implementation rules

1. Follow the agreed monorepo structure.
2. Use JavaScript and ES modules.
3. Use npm workspaces.
4. Keep the backend modular but avoid unnecessary abstraction.
5. Follow REST API conventions.
6. Use Prisma migrations.
7. Hash passwords using bcrypt.
8. Protect administrative operations using JWT authentication.
9. Validate incoming API requests using Zod.
10. Implement consistent error handling.
11. Keep frontend and backend configuration separate.
12. Document all setup and development commands.

## Development approach

Implement the project in the following sequence:

1. Initialize repository and npm workspaces.
2. Scaffold React + Vite.
3. Initialize Express backend.
4. Implement health endpoint.
5. Configure PostgreSQL and Prisma.
6. Create database models and migration.
7. Implement admin seeding.
8. Implement authentication APIs.
9. Implement blog CRUD APIs.
10. Implement React pages and components.
11. Integrate frontend with backend.
12. Verify the complete application.
13. Write project documentation.

Do not skip ahead or introduce deployment infrastructure.

## Important constraints

DO NOT implement:

- Docker or Docker Compose.
- GitHub Actions.
- Kubernetes.
- Cloud infrastructure.
- Coolify.
- Redis.
- Microservices.
- Image uploads.
- Comments or likes.
- Public registration.
- Complex role management.
- Unrequested features.

These will be implemented in subsequent learning milestones.

## Working agreement

Before implementation:

1. Inspect the existing repository.
2. Present a brief implementation plan.
3. Identify any missing configuration or prerequisites.

During implementation:

1. Work in small, logical steps.
2. Explain important technical decisions.
3. Avoid unnecessary dependencies.
4. Do not silently change the agreed architecture.
5. Do not hardcode secrets or credentials.
6. Do not claim a feature works without verifying it.
7. Run relevant commands and resolve errors.

After implementation:

1. Verify frontend startup.
2. Verify backend startup.
3. Verify database connectivity.
4. Verify Prisma migrations.
5. Verify admin seeding.
6. Verify all API endpoints.
7. Verify authentication and authorization.
8. Verify the complete blog workflow.
9. Check that `.env` files are excluded from Git.
10. Update README.md, docs/DEVELOPMENT.md and docs/API.md.

## Final deliverables

Provide:

- Complete working source code.
- Database schema and migrations.
- Seed script.
- Environment example files.
- API documentation.
- Development documentation.
- Root-level development scripts.
- A summary of implemented functionality.
- Commands to run the application.
- Any known limitations.

Do not begin Milestone 2 until Milestone 0 and Milestone 1 have been implemented and verified.

The most important objective is to create a small, reliable application that we can progressively evolve into a production-deployed application while learning DevOps.