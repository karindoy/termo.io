# Build context is the repo root (required to resolve npm workspaces).
# See infra/docker-compose.yml: context: .., dockerfile: backend/Dockerfile

FROM node:20.16.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --include-workspace-root

FROM deps AS build
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
RUN npm run build --workspace=backend

FROM node:20.16.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --include-workspace-root --omit=dev
COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
