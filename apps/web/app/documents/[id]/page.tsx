"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type DocumentDetails = {
  id: string;
  status: "UPLOADED" | "OCR_PROCESSING" | "OCR_DONE" | "FAILED";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  storagePath: string;
  ocrText: string | null;
};

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldPoll = useMemo(() => doc?.status === "OCR_PROCESSING", [doc?.status]);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  async function fetchDoc() {
    setError(null);
    try {
      const res = await api.get<DocumentDetails>(`/documents/${id}`);
      setDoc(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.response?.data?.message || err?.message || "Falha ao carregar documento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!shouldPoll) return;

    const t = setInterval(() => {
      fetchDoc();
    }, 2000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

  async function downloadOriginal() {
    if (!doc) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await api.get(`/documents/${doc.id}/file`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: doc.mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName || `document_${doc.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao baixar arquivo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100">
      <header className="border-b border-white/10 bg-neutral-950/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10" />
            <div>
              <div className="text-sm font-semibold">Paggo OCR</div>
              <div className="text-xs text-white/50">Documento • Detalhe</div>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : !doc ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Documento não encontrado.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold">{doc.originalName}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {doc.mimeType} • {formatBytes(doc.sizeBytes)} •{" "}
                    {new Date(doc.createdAt).toLocaleString()}
                  </div>
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  {doc.status}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={downloadOriginal}
                  disabled={downloading}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:opacity-50"
                >
                  {downloading ? "Baixando..." : "Baixar original"}
                </button>

                {doc.status === "OCR_PROCESSING" && (
                  <div className="rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-2 text-sm text-white/70">
                    Processando OCR… (polling automático)
                  </div>
                )}

                {doc.status === "FAILED" && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                    OCR falhou. Tente reenviar ou verifique o tipo de arquivo.
                  </div>
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-lg font-semibold">Texto extraído (OCR)</h2>
                <p className="mt-1 text-sm text-white/60">
                  Disponível quando status = OCR_DONE.
                </p>

                {doc.status !== "OCR_DONE" ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-6 text-sm text-white/60">
                    OCR ainda não disponível.
                  </div>
                ) : (
                  <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-neutral-950/30 p-4 text-sm text-white/80">
                    {doc.ocrText?.trim() ? doc.ocrText : "(OCR retornou vazio)"}
                  </pre>
                )}
              </div>
            </section>

            <aside className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
              <h3 className="text-lg font-semibold">Próximas etapas</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>• POST /documents/:id/chat (LLM)</li>
                <li>• Persistir sessões/mensagens</li>
                <li>• Download PDF com apêndice</li>
                <li>• OCR assíncrono com fila</li>
              </ul>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
