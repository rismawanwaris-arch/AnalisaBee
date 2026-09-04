# ── Stage 1: build Vite frontend ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
# install everything (dev deps needed for vite build + tsx + tsc)
RUN npm ci

COPY . .

# generate Prisma client (needs dummy DATABASE_URL at build time)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma generate

# build the React SPA into dist/
RUN npm run build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# install all deps — tsx is a devDep but used by `npm start`
RUN npm ci

# copy built frontend
COPY --from=builder /app/dist ./dist

# copy Prisma schema + generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma

# copy server source (tsx transpiles at runtime in production)
COPY src/server ./src/server
COPY src/lib ./src/lib
COPY tsconfig.json ./

# entrypoint: run migrations then start server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
