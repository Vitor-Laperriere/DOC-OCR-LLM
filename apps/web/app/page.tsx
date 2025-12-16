"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

type DocumentItem = {
  id: string;
  status: string;
  createdAt?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
};

function formatBytes(n?: number) {
  if (n === undefined) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const canUpload = useMemo(() => Boolean(selectedFile) && status !== "uploading", [selectedFile, status]);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  async function loadDocuments() {
    setDocsLoading(true);
    try {
      const res = await api.get<DocumentItem[]>("/documents");
      setDocuments(res.data ?? []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setStatus("error");
      setMessage(err?.response?.data?.message || err?.message || "Falha ao carregar documentos.");
    } finally {
      setDocsLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onUpload() {
    if (!selectedFile) return;

    setStatus("uploading");
    setMessage(null);
    setProgress(0);

    try {
      const allowed = ["image/png", "image/jpeg"];
      if (!allowed.includes(selectedFile.type)) {
        throw new Error("Formato inválido. Envie PNG ou JPG.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post("/documents", formData, {
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            setProgress(Math.min(100, Math.max(0, pct)));
          } else {
            setProgress((p) => (p < 90 ? p + 5 : p));
          }
        },
      });

      setProgress(100);
      setStatus("success");
      setMessage("Upload concluído. Documento salvo e registrado.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await loadDocuments();
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.response?.data?.message || err?.message || "Falha no upload.");
    }
  }

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100">
      <header className="border-b border-white/10 bg-neutral-950/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10" />
            <div>
              <div className="text-sm font-semibold">Paggo OCR</div>
              <div className="text-xs text-white/50">Upload • OCR • Chat</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDocuments}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Atualizar
            </button>
            <button
              onClick={logout}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              Etapa 5 • Upload com Progresso
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Envie uma fatura e acompanhe o upload em tempo real
            </h1>
            <p className="text-base text-white/70">
              Upload (multipart) + feedback visual e lista de documentos do usuário autenticado.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">Upload de documento</h2>
            <p className="mt-1 text-sm text-white/60">Aceita .jpg e .png.</p>

            <div className="mt-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-white/90"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />

              {selectedFile && (
                <div className="rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 text-sm text-white/70">
                  <div className="font-medium text-white/80">{selectedFile.name}</div>
                  <div className="text-xs text-white/50">
                    {selectedFile.type} • {formatBytes(selectedFile.size)}
                  </div>
                </div>
              )}

              {(status === "uploading" || progress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{status === "uploading" ? "Enviando..." : "Progresso"}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {message && (
                <div
                  className={[
                    "rounded-xl border px-4 py-3 text-sm",
                    status === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-200"
                      : status === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-white/70",
                  ].join(" ")}
                >
                  {message}
                </div>
              )}

              <button
                onClick={onUpload}
                disabled={!canUpload}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "uploading" ? "Enviando..." : "Upload"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Seus documentos</h2>
              <p className="text-sm text-white/60">Obtido via GET /documents (JWT).</p>
            </div>
            <div className="text-xs text-white/50">{docsLoading ? "Carregando..." : `${documents.length} item(ns)`}</div>
          </div>

          {docsLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-white/10 bg-neutral-950/30" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-6 text-sm text-white/60">
              Nenhum documento ainda. Faça upload acima para aparecer aqui.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-white/10 bg-neutral-950/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {doc.originalName ?? `Documento ${doc.id.slice(0, 8)}…`}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {doc.sizeBytes ? formatBytes(doc.sizeBytes) : ""} {doc.mimeType ? `• ${doc.mimeType}` : ""}
                      </div>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                      {doc.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-white/40">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : ""}
                    </div>
                    <Link href={`/documents/${doc.id}`} className="text-xs font-semibold text-white/80 hover:text-white">
                      Ver detalhe →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
