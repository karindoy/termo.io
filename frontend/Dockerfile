# Build context is the repo root (required to resolve npm workspaces).
# See infra/docker-compose.yml: context: .., dockerfile: frontend/Dockerfile

FROM node:20.16.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=frontend --include-workspace-root

FROM deps AS build
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/vite.config.ts frontend/vite.config.ts
COPY frontend/index.html frontend/index.html
COPY frontend/src frontend/src
ARG VITE_SOCKET_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:80/ >/dev/null || exit 1
