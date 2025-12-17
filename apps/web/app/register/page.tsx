"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

type RegisterResponse = {
  id: string;
  email: string;
  createdAt: string;
};

type LoginResponse = { accessToken: string };

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) {
      router.replace("/");
    }
  }, [router]);

  const canSubmit = useMemo(
    () =>
      email.trim().length > 0 &&
      password.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      password === confirmPassword &&
      !loading,
    [email, password, confirmPassword, loading]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);

    try {
      await api.post<RegisterResponse>("/auth/register", {
        email,
        password,
      });

      // Autentica logo após registrar para manter experiência simples
      const loginRes = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });

      setToken(loginRes.data.accessToken);
      router.replace("/");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao registrar. Verifique se a API está rodando."
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
              Crie sua conta com email e senha
            </h1>
            <p className="text-base text-white/70 break-words">
             
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur overflow-hidden">
            <h2 className="text-lg font-semibold">Registrar</h2>
            <p className="mt-1 text-sm text-white/60">Preencha seus dados.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">E-mail</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Senha</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Confirmar senha</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-200">
                    As senhas precisam ser iguais.
                  </p>
                )}
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
                {loading ? "Registrando..." : "Registrar"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/60">
              Já possui conta?{" "}
              <Link
                href="/login"
                className="font-semibold text-white hover:underline"
              >
                Fazer login
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
