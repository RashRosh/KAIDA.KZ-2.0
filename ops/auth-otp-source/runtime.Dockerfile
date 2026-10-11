# Isolated acceptance only: reuse the verified host build, with current locked Linux dependencies.
ARG OS_IMAGE=kaida-auth-source-os:local
ARG PROD_DEPS_IMAGE=kaida-auth-source-prod-deps:local
ARG TOOLS_IMAGE=kaida-auth-source-tools:local
FROM ${PROD_DEPS_IMAGE} AS dependencies
FROM ${TOOLS_IMAGE} AS metadata
FROM ${OS_IMAGE}
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PHOTO_STORAGE_DIR=/data/photos
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=metadata --chown=node:node /app/package.json ./
COPY --chown=node:node next.config.ts ./
COPY --from=metadata --chown=node:node /app/src/modules/search/word-forms ./src/modules/search/word-forms
RUN mkdir -p /data/photos && chown node:node /data/photos \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
