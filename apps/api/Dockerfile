FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build

COPY drizzle ./drizzle
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN pnpm --filter @sw-exchange/shared build
RUN pnpm --filter @sw-exchange/api build

FROM base AS runtime

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/shared ./packages/shared

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
