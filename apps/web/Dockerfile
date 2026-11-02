# syntax=docker/dockerfile:1

# --- Stage 1: build the React application ---------------------------------
# The build context is the repository root (npm workspace monorepo).
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy only the manifests first. Docker caches this layer, so dependency
# installation is skipped on rebuilds that only change application source.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

# npm ci installs the exact dependency tree from the lockfile.
RUN npm ci

COPY apps/web ./apps/web

# Vite embeds VITE_* variables into the JavaScript bundle at build time.
# The browser runs on the host, so it must reach the API through the
# published backend port, not the Docker-internal container name.
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build --workspace=@devops-blog/web

# --- Stage 2: serve the static build with Nginx ---------------------------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine already starts Nginx in the foreground with the correct PID 1
# behavior, so no CMD override is needed.
