FROM node:24.21-alpine3.24 AS base

# Upgrade OS packages with known CVEs in the base image (openssl CVE-2026-14456,
# zlib CVE-2026-85091). zlib is preinstalled, so `apk add` would not update it.
RUN apk upgrade --no-cache libcrypto3 libssl3 zlib

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN mkdir -p public

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# The standalone server starts with node directly and needs no install, so remove
# npm/npx: project overrides do not patch its bundled dependencies (brace-expansion,
# ip-address, tar, undici).
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
