# ── Stage 1: build Vite frontend ──────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# install everything (dev deps needed for vite build + tsx + tsc)
RUN npm ci --no-audit

COPY . .

# generate Prisma client (needs dummy DATABASE_URL at build time)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma generate

# build the React SPA into dist/
RUN npm run build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# reuse node_modules from builder — avoids a second npm ci over the network
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# copy built frontend
COPY --from=builder /app/dist ./dist

# copy Prisma generated client (output = src/generated/prisma per schema.prisma)
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts ./

# copy server source (tsx transpiles at runtime in production)
COPY src/server ./src/server
COPY src/lib ./src/lib
COPY tsconfig.json ./

# one-off maintenance scripts — run via `docker compose exec app npx tsx scripts/<name>.ts`
COPY scripts/*.ts ./scripts/

# entrypoint: run migrations then start server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
