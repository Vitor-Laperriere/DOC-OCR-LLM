#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "apps", "api");
const WEB_DIR = path.join(ROOT, "apps", "web");

function log(msg) {
  process.stdout.write(`[dev] ${msg}\n`);
}
function warn(msg) {
  process.stderr.write(`[dev][warn] ${msg}\n`);
}
function fail(msg) {
  process.stderr.write(`[dev][error] ${msg}\n`);
  process.exit(1);
}

function isWin() {
  return process.platform === "win32";
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: isWin(), // necessário no Windows para comandos como "npm"
      ...opts,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function startProcess(name, command, args, opts = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWin(),
    ...opts,
  });
  child._devName = name;
  return child;
}

async function commandExists(command, args = ["--version"]) {
  try {
    await run(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function getDockerComposeCmd() {
  // Prefer "docker compose"
  try {
    await run("docker", ["compose", "version"], { stdio: "ignore" });
    return { cmd: "docker", argsPrefix: ["compose"] };
  } catch {}
  // Fallback "docker-compose"
  try {
    await run("docker-compose", ["version"], { stdio: "ignore" });
    return { cmd: "docker-compose", argsPrefix: [] };
  } catch {}
  fail("Docker Compose não encontrado. Instale Docker Desktop (ou docker-compose).");
}

function waitPort(host, port, timeoutMs = 60_000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);

      socket.on("connect", () => {
        socket.end();
        resolve();
      });

      socket.on("timeout", () => {
        socket.destroy();
        retry();
      });

      socket.on("error", () => {
        socket.destroy();
        retry();
      });

      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout aguardando ${host}:${port}`));
          return;
        }
        setTimeout(tryOnce, 800);
      }
    };

    tryOnce();
  });
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function ensureEnvFiles() {
  // apps/api/.env
  const apiEnvPath = path.join(API_DIR, ".env");
  if (!existsSync(apiEnvPath)) {
    log("Criando apps/api/.env (não existia)...");
    const content = `# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Auth (JWT)
JWT_SECRET=change-me
JWT_EXPIRES_IN=3600s

# Database (docker-compose)
DATABASE_URL=postgresql://paggo:paggo@localhost:5432/paggo?schema=public

# OCR
OCR_LANG=por+eng
# native (requer tesseract e pdftoppm instalados no host) | js (tesseract.js)
OCR_ENGINE=native

# LLM provider: openai | gemini
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_OUTPUT_TOKENS=400

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
`;
    writeFileSync(apiEnvPath, content, "utf8");
    warn("Preencha OPENAI_API_KEY e/ou GEMINI_API_KEY em apps/api/.env para o chat funcionar.");
  } else {
    log("apps/api/.env já existe (não sobrescrevendo).");
  }

  // apps/web/.env.local
  const webEnvPath = path.join(WEB_DIR, ".env.local");
  if (!existsSync(webEnvPath)) {
    log("Criando apps/web/.env.local (não existia)...");
    const content = `NEXT_PUBLIC_API_URL=http://localhost:3001
`;
    writeFileSync(webEnvPath, content, "utf8");
  } else {
    log("apps/web/.env.local já existe (não sobrescrevendo).");
  }
}

function pickInstallCmd(dir) {
  // Se existir package-lock, tanto faz; npm install funciona em todos os casos.
  // (Se você quiser "npm ci" estrito, mude aqui.)
  return { cmd: "npm", args: ["install"] };
}

async function prismaMigrateAndGenerate() {
  log("Rodando Prisma generate + migrate dev (apps/api)...");
  await run("npm", ["exec", "prisma", "generate"], { cwd: API_DIR });
  await run("npm", ["exec", "prisma", "migrate", "dev"], { cwd: API_DIR });
}

async function dockerUp(compose) {
  log("Subindo infra (postgres + redis) via docker compose...");
  await run(compose.cmd, [...compose.argsPrefix, "up", "-d"], { cwd: ROOT });
}

async function main() {
  log(`OS: ${process.platform}`);
  if (!(await commandExists("node", ["--version"]))) fail("Node.js não encontrado.");
  if (!(await commandExists("npm", ["--version"]))) fail("npm não encontrado.");
  if (!(await commandExists("docker", ["--version"]))) fail("Docker não encontrado. Instale Docker Desktop.");

  const compose = await getDockerComposeCmd();

  ensureDir(path.join(ROOT, "scripts"));
  ensureEnvFiles();

  await dockerUp(compose);

  log("Aguardando Postgres (localhost:5432)...");
  await waitPort("127.0.0.1", 5432, 90_000);

  log("Aguardando Redis (localhost:6379)...");
  await waitPort("127.0.0.1", 6379, 60_000);

  // Install deps
  log("Instalando dependências (apps/api)...");
  {
    const { cmd, args } = pickInstallCmd(API_DIR);
    await run(cmd, args, { cwd: API_DIR });
  }

  log("Instalando dependências (apps/web)...");
  {
    const { cmd, args } = pickInstallCmd(WEB_DIR);
    await run(cmd, args, { cwd: WEB_DIR });
  }

  await prismaMigrateAndGenerate();

  // Start processes
  log("Iniciando API (apps/api)...");
  const api = startProcess("api", "npm", ["run", "start:dev"], { cwd: API_DIR });

  log("Iniciando WEB (apps/web)...");
  const web = startProcess("web", "npm", ["run", "dev"], { cwd: WEB_DIR });

  const children = [api, web];

  function killChildren() {
    for (const ch of children) {
      if (!ch?.pid) continue;

      if (isWin()) {
        // taskkill encerra o processo e seus filhos no Windows
        spawn("taskkill", ["/PID", String(ch.pid), "/T", "/F"], { stdio: "ignore", shell: true });
      } else {
        try {
          ch.kill("SIGINT");
        } catch {}
      }
    }
  }

  process.on("SIGINT", () => {
    log("Encerrando (Ctrl+C)...");
    killChildren();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("Encerrando (SIGTERM)...");
    killChildren();
    process.exit(0);
  });

  log("");
  log("Rodando:");
  log(" - API health: http://localhost:3001/health");
  log(" - Web login:  http://localhost:3000/login");
  log("");
  log("Ctrl+C para parar (containers ficam em pé; use docker compose down para remover).");

  // Mantém o processo vivo enquanto filhos rodam
  await new Promise((resolve) => {
    let exited = 0;
    for (const ch of children) {
      ch.on("exit", () => {
        exited += 1;
        if (exited >= children.length) resolve();
      });
    }
  });
}

main().catch((e) => {
  fail(e?.message ?? String(e));
});
