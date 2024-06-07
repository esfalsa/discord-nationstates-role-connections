FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml tsconfig.json rollup.config.mjs ./
COPY patches ./patches/
COPY src ./src/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=build /app/dist /app/dist

ARG PORT
ENV PORT $PORT
EXPOSE ${PORT:-3000}

CMD ["node", "/app/dist/index.mjs"]
