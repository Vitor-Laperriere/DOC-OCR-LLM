# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Dependências do OCR (tesseract + pdftoppm)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  tesseract-ocr \
  poppler-utils \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig*.json ./
COPY src ./src

# Prisma generate precisa rodar na mesma "árvore de node_modules" que irá para o runtime
# Se seu prisma.config.ts exigir DATABASE_URL, forneça um dummy em build:
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN npm exec prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# IMPORTANTE:
# Copie o node_modules DO BUILD (pois já contém o Prisma Client gerado + node_modules/.prisma)
COPY --from=build /app/node_modules ./node_modules

# Copie package.json p/ npm exec funcionar (migrate deploy)
COPY package.json package-lock.json ./

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

RUN mkdir -p /app/storage

EXPOSE 3001

# Migrations + start
CMD ["sh", "-c", "npm exec prisma migrate deploy && node dist/src/main.js"]
