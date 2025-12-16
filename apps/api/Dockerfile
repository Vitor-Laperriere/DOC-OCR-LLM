# apps/api/Dockerfile
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Dependências nativas p/ OCR (tesseract + pdftoppm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
# Prisma 7: o generate exige DATABASE_URL existir no ambiente.
# Use um placeholder válido só para o build (não precisa conectar).
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig*.json ./
COPY src ./src

RUN npm exec prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3001

# Roda migrations no boot e sobe a API
CMD ["sh","-c","npm exec prisma migrate deploy && node dist/main.js"]
