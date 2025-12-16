## Demo
![Demo](docs/paggo.gif)

# Paggo OCR — Local Setup (1 comando)

Monorepo com:
- **API (NestJS)**: `apps/api` (porta **3001**)
- **Web (Next.js)**: `apps/web` (porta **3000**)
- **Infra (Docker Compose)**: Postgres + Redis

## Pré-requisitos
- **Node.js 18+**
- **Docker** (Docker Desktop no Windows/macOS)
- (Recomendado para OCR robusto) **tesseract** e **pdftoppm**
  - macOS: `brew install tesseract poppler`
  - Linux: instale via apt/yum (ex.: `sudo apt-get install tesseract-ocr poppler-utils`)

## Rodar (um comando)

Na raiz do repositório:

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

### Configurar chaves de LLM (para chat funcionar)

Edite `apps/api/.env` e preencha pelo menos uma:

- `OPENAI_API_KEY=...` (OpenAI)
- `GEMINI_API_KEY=...` (Gemini)

Opcional:

- `LLM_PROVIDER=openai` ou `LLM_PROVIDER=gemini`

### Parar

- `Ctrl + C` (para Web e API)
- Para parar containers: `docker compose down`
