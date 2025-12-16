# ---------- build ----------
FROM node:20-bookworm-slim AS build

# OCR deps (tesseract + pdftoppm)
RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr \
  poppler-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Prisma v7 pode exigir DATABASE_URL no prisma.config.ts até para generate.
# Use um valor dummy (não-secreto) no build.
ARG DATABASE_URL="postgresql://paggo:paggo@localhost:5432/paggo?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Gera Prisma Client (necessário para TS compilar)
RUN npm exec prisma generate

# Build do Nest
RUN npm run build


# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr \
  poppler-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Se você usa storage local, em produção é melhor trocar por S3,
# mas para MVP:
RUN mkdir -p /app/storage

# Em produção, aplique migrations
CMD ["sh", "-c", "npm exec prisma migrate deploy && node dist/main.js"]
