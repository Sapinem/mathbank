# MathBank — Dockerfile multi-stage (M16)
#
# Membangun image produksi minimal: deps → build (standalone) → runner.
# Output standalone (`output: "standalone"`) menghasilkan server Next mandiri
# dengan node_modules minimal, tanpa pnpm di image akhir.
#
# Build:  docker build -t mathbank .
# Jalankan via docker-compose.yml (app + PostgreSQL + Caddy TLS).

# ---------- 1. deps ----------
FROM node:24-slim AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `--ignore-scripts` melewati `prepare` (install git hooks) yang tak relevan di
# image (tanpa .git). Skrip build Next tak butuh hook git.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---------- 2. builder ----------
FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Standalone diaktifkan lewat env (lihat next.config.ts). Telemetri Next dimatikan.
ENV NEXT_OUTPUT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
# Build tak butuh DB & rahasia nyata — nilai dummy agar modul yg membaca env saat
# impor tak gagal. RAHASIA PRODUKSI di-inject saat runtime (docker-compose), BUKAN
# dibakar ke image. (Jangan taruh rahasia nyata di ENV image.)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=build-placeholder-injected-at-runtime-not-a-secret
ENV SETTINGS_ENC_KEY=0000000000000000000000000000000000000000000000000000000000000000
RUN pnpm build

# ---------- 3. runner ----------
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Jalankan sebagai non-root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Artefak standalone: server.js + node_modules minimal + static + public.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Direktori media (volume) — dibuat dgn izin user app.
RUN mkdir -p /app/storage/media && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

# Healthcheck memakai endpoint liveness murni (tanpa DB) — cepat.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health?probe=liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
