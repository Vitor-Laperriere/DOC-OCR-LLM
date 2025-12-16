# =========
# Build stage
# =========
FROM node:20-bookworm-slim AS build

# Dependências nativas para OCR robusto:
# - tesseract-ocr (OCR nativo)
# - poppler-utils (pdftoppm para PDF escaneado)
RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr \
  poppler-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps (você usa npm + package-lock)
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o restante (inclui prisma/, prisma.config.ts, src/, etc.)
COPY . .

# Prisma generate (não precisa do banco)
RUN npm exec prisma generate

# Build do Nest
RUN npm run build

# =========
# Runtime stage
# =========
FROM node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr \
  poppler-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia app buildado + node_modules do build stage (inclui prisma CLI)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/dist ./dist

# Storage local (se você não usar disco persistente no Render)
RUN mkdir -p /app/storage /app/storage/tmp

ENV NODE_ENV=production

# IMPORTANTE: prisma migrate deploy é o recomendado para aplicar migrations em prod
# (não use migrate dev em produção)
CMD sh -c "npm exec prisma migrate deploy && node dist/main.js"
