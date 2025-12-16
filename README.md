````md
## Demo
![Demo](docs/paggo.gif)

# Paggo OCR — Local Setup (1 comando)

Monorepo com:
- **API (NestJS)**: `apps/api` (porta **3001**)
- **Web (Next.js)**: `apps/web` (porta **3000**)
- **Infra (Docker Compose)**: Postgres + Redis

---

## Chaves, tokens e credenciais necessárias

### 1) JWT (obrigatório)
A API emite JWT no login. Você precisa configurar:

- `JWT_SECRET` (obrigatório): string qualquer, forte.
- `JWT_EXPIRES_IN` (opcional): ex. `3600s`.

**Como obter:** você mesmo define.
Exemplo:
```env
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=3600s
````

### 2) Banco de dados (obrigatório)

O projeto usa Postgres do Docker Compose. Você precisa ter no `.env` da API:

* `DATABASE_URL` (obrigatório)

Com o seu `docker-compose.yml`, o correto é:

```env
DATABASE_URL=postgresql://paggo:paggo@localhost:5432/paggo?schema=public
```

### 3) LLM (opcional para o sistema funcionar completo)

Para o recurso de **perguntar sobre o documento** (chat), você precisa configurar **pelo menos 1 provider**:

#### OpenAI (opcional)

* `OPENAI_API_KEY` (obrigatório se `LLM_PROVIDER=openai`)
* `OPENAI_MODEL` (opcional)
* `OPENAI_MAX_OUTPUT_TOKENS` (opcional)

**Como obter:**

1. Crie conta e um projeto na OpenAI Platform.
2. Gere uma API key.
3. Cole em `apps/api/.env` como `OPENAI_API_KEY=...`.

#### Gemini (opcional)

* `GEMINI_API_KEY` (obrigatório se `LLM_PROVIDER=gemini`)
* `GEMINI_MODEL` (opcional)

**Como obter:**

1. Crie uma API key para Gemini/Google AI (Generative Language API).
2. Cole em `apps/api/.env` como `GEMINI_API_KEY=...`.

> Observação: em projetos reais, nunca commite `.env`. Use `.env.example` e variáveis no deploy.

### 4) OCR (recomendado)

Sem isso, OCR pode ficar limitado (principalmente PDF escaneado).

* `OCR_ENGINE` (opcional): `native` ou `js`
* `OCR_LANG` (opcional): ex. `por+eng`

**Dependências nativas recomendadas:**

* `tesseract` (OCR nativo)
* `pdftoppm` (vem do `poppler`, para PDF escaneado → imagem)

---

## Pré-requisitos

* **Node.js 18+**
* **Docker** (Docker Desktop no Windows/macOS)
* (Recomendado para OCR robusto) **tesseract** e **pdftoppm**

  * macOS: `brew install tesseract poppler`
  * Linux (Debian/Ubuntu): `sudo apt-get install -y tesseract-ocr poppler-utils`
  * Windows: instale Tesseract e Poppler e garanta no `PATH` (ou use `OCR_ENGINE=js`)

---

## Rodar (um comando)

Na raiz do repositório:

```bash
node scripts/dev.mjs
```

### O script automaticamente

* Sobe Postgres + Redis via Docker Compose
* Cria `.env` (API) e `.env.local` (Web) se não existirem
* Instala dependências (API + Web)
* Roda `prisma generate` + `prisma migrate dev`
* Inicia API e Web

### Acessos

* API health: [http://localhost:3001/health](http://localhost:3001/health)
* Web (login):  [http://localhost:3000/login](http://localhost:3000/login)

### Configurar chaves de LLM (para chat funcionar)

Edite `apps/api/.env` e preencha pelo menos uma:

* `OPENAI_API_KEY=...` (OpenAI)
* `GEMINI_API_KEY=...` (Gemini)

Opcional:

* `LLM_PROVIDER=openai` ou `LLM_PROVIDER=gemini`

### Parar

* `Ctrl + C` (para Web e API)
* Para parar containers:

  ```bash
  docker compose down
  ```

---

# Se o script falhar: rodar manualmente (passo a passo)

## 1) Subir Postgres + Redis

Na raiz do repo:

```bash
docker compose up -d
docker compose ps
```

## 2) Configurar variáveis de ambiente

### 2.1 API (`apps/api/.env`)

Crie/edite `apps/api/.env`:

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

### 2.2 Web (`apps/web/.env.local`)

Crie/edite `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 3) Instalar dependências

### 3.1 API

```bash
cd apps/api
npm install
```

### 3.2 Web

```bash
cd ../web
npm install
```

## 4) Prisma: generate + migrate

No `apps/api`:

```bash
cd ../api
npm exec prisma generate
npm exec prisma migrate dev
```

Checkpoint: migrations aplicadas sem erro.

## 5) Subir API

```bash
cd apps/api
npm run start:dev
```

Teste:

```bash
curl -i http://localhost:3001/health
```

## 6) Subir Web

Em outro terminal:

```bash
cd apps/web
npm run dev
```

Acesse:

* [http://localhost:3000/login](http://localhost:3000/login)

---

## Troubleshooting rápido

### Banco não conecta

* Verifique `docker compose ps`
* Confira `DATABASE_URL` e porta `5432`

### OCR em PDF escaneado falha

* Confirme `pdftoppm`:

  ```bash
  which pdftoppm
  ```
* Instale:

  * macOS: `brew install poppler`
  * Ubuntu: `sudo apt-get install poppler-utils`

### LLM retorna erro (quota / key inválida)

* Confirme `OPENAI_API_KEY` ou `GEMINI_API_KEY`
* Troque provider:

  ```env
  LLM_PROVIDER=gemini
  ```

  ou

  ```env
  LLM_PROVIDER=openai
  ```

---

```
::contentReference[oaicite:0]{index=0}
```
