# ── Build ─────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Production ────────────────────────────────────
FROM node:20-slim
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/skill ./skill

RUN addgroup --system --gid 1001 clawdate \
  && adduser --system --uid 1001 --ingroup clawdate clawdate \
  && mkdir -p /data && chown clawdate:clawdate /data

USER clawdate
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
