# syntax=docker/dockerfile:1
# R3 (docs/slices/r3-deployment-preparation, docs/ops/DEPLOYMENT.md): two targets from one lockfile.
#   runtime - `next start` with production dependencies only, non-root user.
#   tools   - full dependencies and sources: migrations, Production KB import, search-events purge, deploy preflight.
# Secrets are never build arguments or image content: configuration comes from the environment at run time.
ARG NODE_IMAGE=node:24.19.0-trixie-slim@sha256:ab3eebe934147fee049b5eb83c570f68c849a13c930bdfa482de99fcdfa3b3de
ARG PNPM_VERSION=11.19.0

FROM ${NODE_IMAGE} AS os-base
# Exact available security fixes from the R3 Trivy assessment; no host packages are changed.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       gzip=1.13-1+deb13u1 \
       libpcre2-8-0=10.46-1~deb13u3 \
       libsqlite3-0=3.46.1-7+deb13u2 \
       libssl3t64=3.5.7-1~deb13u3 \
       openssl-provider-legacy=3.5.7-1~deb13u3 \
       perl-base=5.40.1-6+deb13u1 \
    && rm -rf /var/lib/apt/lists/*

FROM os-base AS base
ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install --global pnpm@${PNPM_VERSION} \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    && rm -rf /root/.npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile \
    && rm -rf /root/.cache/pnpm /root/.local/share/pnpm/store

FROM deps AS build
COPY next.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
# Memory-conscious build settings for a small Docker VM; override with --build-arg when the host has room.
ARG BUILD_NODE_OPTIONS=--max-old-space-size=1536
ARG BUILD_CPUS=2
ENV NODE_OPTIONS=${BUILD_NODE_OPTIONS} CIRCLE_NODE_TOTAL=${BUILD_CPUS}
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod \
    && rm -rf /root/.cache/pnpm /root/.local/share/pnpm/store

FROM os-base AS runtime
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="kaida-app" org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PHOTO_STORAGE_DIR=/data/photos
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
# Search reads this immutable dictionary by path at request time; keep its attribution alongside it.
COPY --chown=node:node src/modules/search/word-forms/word-forms.v1.csv src/modules/search/word-forms/PROVENANCE.md ./src/modules/search/word-forms/
COPY --chown=node:node package.json next.config.ts ./
RUN mkdir -p /data/photos && chown node:node /data/photos \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS tools
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="kaida-tools" org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production
COPY --chown=node:node package.json drizzle.config.ts tsconfig.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node src ./src
COPY --chown=node:node ops ./ops
RUN mkdir -p /data/photos && chown node:node /data/photos
USER 1000:1000
CMD ["pnpm", "db:migrate"]
