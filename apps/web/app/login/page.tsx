"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

type LoginResponse = { accessToken: string };

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("test@paggo.local");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length >= 6 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      setToken(res.data.accessToken);
      router.replace("/");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Falha ao autenticar. Verifique credenciais e se a API está no ar.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
        <div className="grid w-full gap-10 md:grid-cols-2">
          <section className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              Paggo OCR • Prototype
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Faça login para enviar documentos e extrair texto via OCR
            </h1>
            <p className="text-base text-white/70">
              MVP de autenticação via JWT. Em seguida, você poderá fazer upload, acompanhar progresso
              e ver seus documentos.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">Entrar</h2>
            <p className="mt-1 text-sm text-white/60">
              Use o usuário de teste ou crie um novo via API.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">E-mail</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-white/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Senha</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-white/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mín. 6 caracteres"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                disabled={!canSubmit}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <p className="text-xs text-white/50">
                Dica: se der erro de CORS, habilite CORS no Nest para <code>http://localhost:3000</code>.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
