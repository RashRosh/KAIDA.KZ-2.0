# Local reference worker: the base must contain this checkout's locked dependencies.
ARG TOOLS_IMAGE=kaida-auth-source-tools:local
FROM ${TOOLS_IMAGE}
HEALTHCHECK --interval=15s --timeout=10s --start-period=15s --retries=2 \
  CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/cli/otp-source-maintenance.ts", "health"]
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/cli/otp-source-maintenance.ts", "worker"]
