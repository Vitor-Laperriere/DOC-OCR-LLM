"use client";

import { useParams } from "next/navigation";

export default function DocumentDetailPlaceholder() {
  const params = useParams<{ id: string }>();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <h1 className="text-xl font-semibold">Documento</h1>
      <p className="mt-2 text-white/60">ID: {params.id}</p>
      <p className="mt-6 text-white/60">
        Nesta etapa você vai exibir status, OCR text e chat.
      </p>
    </main>
  );
}
