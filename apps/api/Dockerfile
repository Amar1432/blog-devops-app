# syntax=docker/dockerfile:1

# --- Stage 1: install dependencies and generate the Prisma client ---------
# The build context is the repository root (npm workspace monorepo), so the
# root lockfile can be used with `npm ci`.
FROM node:22-bookworm-slim AS build

# Prisma 6 needs OpenSSL to select and run its query engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifests first: this dependency layer is cached until a manifest or the
# lockfile changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/src ./apps/api/src

# The generated client is written into the hoisted root node_modules/.prisma.
RUN npm run db:generate --workspace=@devops-blog/api

# --- Stage 2: runtime image ----------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# Create the unprivileged user before copying files, and copy with --chown.
# Running `chown -R /app` afterwards would rewrite every file in a new layer
# and roughly duplicate the image size.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser

# Copy the hoisted workspace dependencies (including the generated Prisma
# client and the Prisma CLI used for explicit `migrate deploy` runs).
COPY --chown=appuser:appuser --from=build /app/node_modules ./node_modules
COPY --chown=appuser:appuser --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --chown=appuser:appuser --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --chown=appuser:appuser --from=build /app/apps/api/src ./apps/api/src
COPY --chown=appuser:appuser package.json package-lock.json ./

USER appuser

WORKDIR /app/apps/api

EXPOSE 5000

CMD ["node", "src/server.js"]
