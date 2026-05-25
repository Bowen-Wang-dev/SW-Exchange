FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN pnpm --filter @sw-exchange/shared build
RUN pnpm --filter @sw-exchange/web build

FROM base AS runtime

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages/shared ./packages/shared

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["pnpm", "exec", "next", "start", "--port", "3000", "--hostname", "0.0.0.0"]
