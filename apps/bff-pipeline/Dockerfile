# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
# Builds client-pipeline + bff-pipeline; the BFF serves the client build and proxies /api to be-pipeline.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @servenup/bff-pipeline... --filter @servenup/client-pipeline...
RUN pnpm --filter @servenup/client-pipeline --filter @servenup/bff-pipeline build
RUN pnpm deploy --legacy --filter @servenup/bff-pipeline --prod /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production PORT=8080 CLIENT_DIST=/app/public
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/bff-pipeline/dist ./dist
COPY --from=build /repo/apps/client-pipeline/dist ./public
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
