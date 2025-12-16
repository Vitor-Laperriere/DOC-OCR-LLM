# Demo

![Demo](paggo.gif)

# Paggo OCR — Local Setup (1 comando)

Monorepo com:

- **API (NestJS)**: `apps/api` (porta **3001**)
- **Web (Next.js)**: `apps/web` (porta **3000**)
- **Infra (Docker Compose)**: Postgres + Redis

---

## Chaves, tokens e credenciais necessárias

### 1. JWT (obrigatório)

A API emite JWT no login. Configure:

- `JWT_SECRET` (obrigatório): string forte.
- `JWT_EXPIRES_IN` (opcional): ex. `3600s`.

Exemplo:

```env
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=3600s
```

### 2. Banco de dados (obrigatório)

Postgres via Docker Compose. Em `apps/api/.env`:

```env
DATABASE_URL=postgresql://paggo:paggo@localhost:5432/paggo?schema=public
```

### 3. LLM (opcional para chat)

Para o chat do documento configure **pelo menos um** provider.

#### OpenAI

- `OPENAI_API_KEY` (obrigatório se `LLM_PROVIDER=openai`)
- `OPENAI_MODEL` e `OPENAI_MAX_OUTPUT_TOKENS` opcionais

#### Gemini

- `GEMINI_API_KEY` (obrigatório se `LLM_PROVIDER=gemini`)
- `GEMINI_MODEL` opcional

> Não faça commit de `.env`; use `.env.example` em produção.

### 4. OCR (recomendado)

- `OCR_ENGINE`: `native` ou `js`
- `OCR_LANG`: ex. `por+eng`
- Dependências: `tesseract` e `pdftoppm` (poppler) para OCR em PDFs escaneados.

---

## Pré-requisitos

- **Node.js 18+**
- **Docker**
- **tesseract** e **pdftoppm** (recomendado)
  - macOS: `brew install tesseract poppler`
  - Linux (Debian/Ubuntu): `sudo apt-get install -y tesseract-ocr poppler-utils`
  - Windows: instale Tesseract + Poppler e ajuste o `PATH` (ou use `OCR_ENGINE=js`)

---

## Rodar (um comando)

```bash
node scripts/dev.mjs
```

### O script automaticamente

- Sobe Postgres + Redis via Docker Compose
- Cria `.env` (API) e `.env.local` (Web) se não existirem
- Instala dependências (API + Web)
- Roda `prisma generate` + `prisma migrate dev`
- Inicia API e Web

### Acessos

- API health: <http://localhost:3001/health>
- Web (login): <http://localhost:3000/login>

### Configurar chaves de LLM

Edite `apps/api/.env`:

- `OPENAI_API_KEY=...`
- `GEMINI_API_KEY=...`
- Opcional: `LLM_PROVIDER=openai` ou `LLM_PROVIDER=gemini`

### Parar

- `Ctrl + C` encerra API e Web
- Para parar containers:

  ```bash
  docker compose down
  ```

---

# Se o script falhar: passo a passo manual

## 1. Subir Postgres + Redis

```bash
docker compose up -d
docker compose ps
```

## 2. Configurar variáveis de ambiente

### API (`apps/api/.env`)

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000

JWT_SECRET=change-me
JWT_EXPIRES_IN=3600s

DATABASE_URL=postgresql://paggo:paggo@localhost:5432/paggo?schema=public

OCR_LANG=por+eng
OCR_ENGINE=native

LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_OUTPUT_TOKENS=400

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

### Web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 3. Instalar dependências

```bash
cd apps/api && npm install
cd ../web && npm install
```

## 4. Prisma (generate + migrate)

```bash
cd apps/api
npm exec prisma generate
npm exec prisma migrate dev
```

## 5. Subir API

```bash
cd apps/api
npm run start:dev
```

Teste:

```bash
curl -i http://localhost:3001/health
```

## 6. Subir Web

```bash
cd apps/web
npm run dev
```

Acesse <http://localhost:3000/login>.

---

## Troubleshooting rápido

### Banco não conecta

- Verifique `docker compose ps`
- Confira `DATABASE_URL` e porta `5432`

### OCR em PDF escaneado falha

- Cheque `which pdftoppm`
- Se precisar, instale:
  - macOS: `brew install poppler`
  - Ubuntu: `sudo apt-get install poppler-utils`

### LLM retorna erro

- Confirme `OPENAI_API_KEY` ou `GEMINI_API_KEY`
- Mude o provider conforme necessidade:

  ```env
  LLM_PROVIDER=gemini
  ```

  ou

  ```env
  LLM_PROVIDER=openai
  ```

---
