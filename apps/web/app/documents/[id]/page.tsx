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

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

type ChatResponse = {
  sessionId: string;
  messages: ChatMessage[];
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
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const shouldPoll = useMemo(
    () => doc?.status === "OCR_PROCESSING",
    [doc?.status]
  );

  useEffect(() => {
    let url: string | null = null;

    async function loadPreview() {
      if (!doc) return;
      setPreviewLoading(true);
      try {
        const res = await api.get(`/documents/${doc.id}/file`, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: doc.mimeType });
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch {
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    }

    loadPreview();

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc?.id]); // eslint-disable-line

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
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao carregar documento."
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchChat() {
    if (!id) return;
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await api.get<ChatResponse>(`/documents/${id}/chat`);
      setMessages(res.data.messages ?? []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setChatError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao carregar chat."
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function downloadWithAppendix() {
    if (!doc) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await api.get(`/documents/${doc.id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        (doc.originalName || `document_${doc.id}`).replace(
          /\.(png|jpe?g|pdf|webp)$/i,
          ""
        ) + "_with_ocr_chat.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao baixar PDF com apêndice."
      );
    } finally {
      setDownloading(false);
    }
  }

  async function sendQuestion() {
    if (!doc || doc.status !== "OCR_DONE") return;
    const q = question.trim();
    if (!q) return;

    setSending(true);
    setChatError(null);

    // otimista: adiciona msg do usuário
    const optimisticUser: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "USER",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setQuestion("");

    try {
      const res = await api.post<{ sessionId: string; answer: string }>(
        `/documents/${doc.id}/chat`,
        {
          question: q,
        }
      );

      const optimisticAssistant: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: res.data.answer || "(sem resposta)",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticAssistant]);

      // opcional: sincroniza com DB (garante ids reais/ordem)
      await fetchChat();
    } catch (err: any) {
      setChatError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao enviar pergunta."
      );
    } finally {
      setSending(false);
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

  useEffect(() => {
    if (doc?.status === "OCR_DONE") {
      fetchChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.status, doc?.id]);

  async function downloadOriginal() {
    if (!doc) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await api.get(`/documents/${doc.id}/file`, {
        responseType: "blob",
      });
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
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Falha ao baixar arquivo."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100">
      <header className="border-b border-white/10 bg-neutral-950/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white/10" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Paggo OCR</div>
              <div className="text-xs text-white/50 break-words">
                Documento • Detalhe
              </div>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 shrink-0"
          >
            ← Voltar
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
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
            <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur overflow-hidden min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-semibold break-words">
                    {doc.originalName}
                  </div>
                  <div className="mt-1 text-sm text-white/60 break-words">
                    {doc.mimeType} • {formatBytes(doc.sizeBytes)} •{" "}
                    {new Date(doc.createdAt).toLocaleString()}
                  </div>
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 shrink-0">
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

                <button
                  onClick={downloadWithAppendix}
                  disabled={downloading}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Baixar com OCR + Chat
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
                  <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-neutral-950/30 p-4 text-sm text-white/80">
                    {doc.ocrText?.trim() ? doc.ocrText : "(OCR retornou vazio)"}
                  </pre>
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-lg font-semibold">
                  Visualização do documento
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Renderizado a partir do arquivo salvo no servidor.
                </p>

                {previewLoading ? (
                  <div className="mt-4 h-64 animate-pulse rounded-xl border border-white/10 bg-neutral-950/30" />
                ) : !previewUrl ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-6 text-sm text-white/60">
                    Não foi possível carregar prévia.
                  </div>
                ) : doc.mimeType === "application/pdf" ? (
                  <iframe
                    className="mt-4 h-[520px] w-full rounded-xl border border-white/10 bg-neutral-950/30"
                    src={previewUrl}
                    title="PDF Preview"
                  />
                ) : doc.mimeType.startsWith("image/") ? (
                  <img
                    className="mt-4 max-h-[520px] w-full rounded-xl border border-white/10 bg-neutral-950/30 object-contain"
                    src={previewUrl}
                    alt={doc.originalName}
                  />
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-6 text-sm text-white/60">
                    Tipo não suportado para visualização inline: {doc.mimeType}
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur overflow-hidden">
              <h3 className="text-lg font-semibold">
                Pergunte sobre o documento
              </h3>
              <p className="mt-1 text-sm text-white/60">
                O assistente responde com base no OCR salvo no servidor.
              </p>

              {doc.status !== "OCR_DONE" && (
                <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-4 text-sm text-white/70">
                  O chat fica disponível quando o OCR finalizar.
                </div>
              )}

              {chatError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {chatError}
                </div>
              )}

              <div className="mt-4 h-[420px] overflow-auto rounded-xl border border-white/10 bg-neutral-950/30 p-4">
                {chatLoading ? (
                  <div className="text-sm text-white/60">
                    Carregando mensagens…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-white/60">
                    Ainda não há mensagens. Faça a primeira pergunta.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={
                          m.role === "USER"
                            ? "flex justify-end"
                            : "flex justify-start"
                        }
                      >
                        <div
                          className={
                            m.role === "USER"
                              ? "max-w-[90%] rounded-2xl bg-white px-4 py-2 text-sm text-neutral-950"
                              : "max-w-[90%] rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90"
                          }
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {m.content}
                          </div>
                          <div className="mt-1 text-[11px] opacity-60">
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-start gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    doc.status === "OCR_DONE"
                      ? "Ex.: Qual é o valor total? Qual o CNPJ?"
                      : "Aguardando OCR…"
                  }
                  disabled={doc.status !== "OCR_DONE" || sending}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-neutral-950/30 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20 disabled:opacity-50"
                />
                <button
                  onClick={sendQuestion}
                  disabled={
                    doc.status !== "OCR_DONE" || sending || !question.trim()
                  }
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:opacity-50 shrink-0"
                >
                  {sending ? "..." : "Enviar"}
                </button>
              </div>

              <div className="mt-3 text-xs text-white/50">
                Dica: pergunte campos objetivos (“valor total”, “CNPJ”, “data”,
                “itens”), ou peça um resumo.
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
