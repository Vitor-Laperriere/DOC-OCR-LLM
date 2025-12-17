"use client";

import Image from "next/image";
import Link from "next/link";
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

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length >= 6 && !loading,
    [email, password, loading],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      setToken(res.data.accessToken);
      router.replace("/");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao autenticar. Verifique se a API está rodando.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <div className="grid w-full gap-10 md:grid-cols-2">
          <section className="space-y-4 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 p-0.5">
                <Image
                  src="/credit-card.svg"
                  alt="Paggo logo"
                  width={14}
                  height={14}
                />
              </span>
              Vitor Laperriere
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight break-words">
              Faça login ou crie uma conta
            </h1>
            <p className="text-base text-white/70 break-words">
              Adicione imagens ou PDFs, extraia texto com OCR e faça perguntas usando LLMs.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur overflow-hidden">
            <h2 className="text-lg font-semibold">Entrar</h2>
            <p className="mt-1 text-sm text-white/60">Use o usuário de teste.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">E-mail</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Senha</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 break-words">
                  {error}
                </div>
              )}

              <button
                disabled={!canSubmit}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/60">
              Não possui conta?{" "}
              <Link
                href="/register"
                className="font-semibold text-white hover:underline"
              >
                Criar conta
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
