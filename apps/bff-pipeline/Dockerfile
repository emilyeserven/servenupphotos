# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
# Builds client-pipeline + bff-pipeline; the BFF serves the client build and proxies /api to be-pipeline.
FROM node:26-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# Node 25+ no longer ships corepack, so install it from npm first. corepack then reads the root package.json's
# packageManager field and fetches that exact pnpm version.
RUN npm install -g corepack@latest && corepack enable
WORKDIR /repo

FROM base AS build
# The package manifests first, so the install below stays cached until a dependency changes, rather than rerunning
# whenever any file does (such as each merge of the photo data pull request). On a Raspberry Pi that saves minutes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bff-pipeline/package.json apps/bff-pipeline/
COPY apps/client-pipeline/package.json apps/client-pipeline/
COPY apps/portfolio/package.json apps/portfolio/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @servenup/bff-pipeline... --filter @servenup/client-pipeline...
COPY . .
RUN pnpm --filter @servenup/client-pipeline --filter @servenup/bff-pipeline build
RUN pnpm deploy --legacy --filter @servenup/bff-pipeline --prod /out

FROM node:26-slim AS runtime
ENV NODE_ENV=production PORT=8080 CLIENT_DIST=/app/public
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/bff-pipeline/dist ./dist
COPY --from=build /repo/apps/client-pipeline/dist ./public
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
