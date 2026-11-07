FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.daechion-worker.json ./
COPY lib/daechion ./lib/daechion
COPY lib/purchase-process.ts ./lib/purchase-process.ts
RUN npm run build:daechion-worker
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.daechion-worker-build ./.daechion-worker-build
COPY scripts/daechion-db.cjs scripts/daechion-migrations.cjs scripts/daechion-api-check.cjs ./scripts/
COPY scripts/daechion-sheets-verify.cjs ./scripts/
COPY db/daechion ./db/daechion
COPY scripts/daechion-order-db.cjs scripts/daechion-order-migrations.cjs ./scripts/
COPY db/daechion-orders ./db/daechion-orders
COPY workers/daechion/billing.cjs ./workers/daechion/billing.cjs
COPY workers/daechion/browser/provider.cjs ./workers/daechion/browser/provider.cjs
COPY workers/daechion/browser/session-store.cjs ./workers/daechion/browser/session-store.cjs
COPY workers/daechion/browser/token-state.cjs ./workers/daechion/browser/token-state.cjs
# First deployment only checks the schema. No billing/enrollment loop by default.
CMD ["node", "workers/daechion/billing.cjs", "--check"]
