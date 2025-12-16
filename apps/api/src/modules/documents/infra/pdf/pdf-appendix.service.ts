import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { promises as fs } from 'node:fs';

function sanitizeForWinAnsi(input: string): string {
  if (!input) return '';

  // Normaliza e troca caracteres que quebram WinAnsi por equivalentes ASCII
  return (
    input
      .normalize('NFKC')
      // setas
      .replaceAll('→', '->')
      .replaceAll('←', '<-')
      .replaceAll('↔', '<->')
      // aspas e apóstrofos “inteligentes”
      .replaceAll('“', '"')
      .replaceAll('”', '"')
      .replaceAll('’', "'")
      .replaceAll('‘', "'")
      // travessões
      .replaceAll('–', '-')
      .replaceAll('—', '-')
      // bullets comuns
      .replaceAll('•', '-')
      // espaços especiais
      .replaceAll('\u00A0', ' ')
      // remove outros caracteres não representáveis (fallback)
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
  );
}

type ChatItem = {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: Date;
};

function formatDate(d: Date) {
  // ISO simplificado, consistente para avaliação
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function truncate(text: string, maxChars: number) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[TRUNCATED]';
}

@Injectable()
export class PdfAppendixService {
  async generate(params: {
    originalAbsolutePath: string;
    originalMimeType: string;
    originalName: string;

    ocrText?: string | null;
    chat?: ChatItem[];

    // Opcional: limite de tamanho para evitar PDF gigante
    maxOcrChars?: number;
    maxChatChars?: number;
  }): Promise<Buffer> {
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);

    // 1) Página 1: original (PDF ou imagem)
    await this.addOriginalFirstPage(
      out,
      params.originalAbsolutePath,
      params.originalMimeType,
      params.originalName,
      font,
    );

    // 2) Apêndice OCR
    const ocr = truncate(params.ocrText ?? '', params.maxOcrChars ?? 120_000);
    await this.addTextSection(
      out,
      font,
      'OCR - Texto extraído',
      ocr.trim() ? ocr : '(OCR não disponível ou vazio)',
    );

    // 3) Apêndice Chat
    const chat = params.chat ?? [];
    const chatTextRaw =
      chat.length === 0
        ? '(Sem interações LLM até o momento)'
        : chat
            .map((m) => `[${formatDate(m.createdAt)}] ${m.role}: ${m.content}`)
            .join('\n\n');

    const chatText = truncate(chatTextRaw, params.maxChatChars ?? 80_000);
    await this.addTextSection(out, font, 'Chat - Interações LLM', chatText);

    const bytes = await out.save();
    return Buffer.from(bytes);
  }

  private async addOriginalFirstPage(
    out: PDFDocument,
    absolutePath: string,
    mime: string,
    originalName: string,
    font: any,
  ) {
    try {
      const bytes = await fs.readFile(absolutePath);

      // PDF: copiar a PRIMEIRA página
      if (
        mime === 'application/pdf' ||
        originalName.toLowerCase().endsWith('.pdf')
      ) {
        const src = await PDFDocument.load(bytes);
        const [first] = await out.copyPages(src, [0]);
        out.addPage(first);
        return;
      }

      // Imagem: desenhar numa página A4
      if (mime.startsWith('image/')) {
        const page = out.addPage([595.28, 841.89]); // A4 em pontos
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const margin = 36;

        let img;
        if (mime === 'image/png') img = await out.embedPng(bytes);
        else img = await out.embedJpg(bytes); // jpeg/webp normalmente cairá aqui se chegar

        const imgW = img.width;
        const imgH = img.height;

        const scale = Math.min(
          (pageWidth - margin * 2) / imgW,
          (pageHeight - margin * 2) / imgH,
        );

        const drawW = imgW * scale;
        const drawH = imgH * scale;

        page.drawImage(img, {
          x: (pageWidth - drawW) / 2,
          y: (pageHeight - drawH) / 2,
          width: drawW,
          height: drawH,
        });

        return;
      }

      // Fallback: tipo não suportado para renderizar como página 1
      const page = out.addPage([595.28, 841.89]);
      page.drawText(
        `Arquivo original não renderizável como imagem/PDF:\n${originalName}\n(${mime})`,
        {
          x: 50,
          y: 780,
          size: 12,
          font,
        },
      );
    } catch (e: any) {
      const page = out.addPage([595.28, 841.89]);
      page.drawText(`Falha ao inserir original no PDF.\n${e?.message ?? e}`, {
        x: 50,
        y: 780,
        size: 12,
        font,
      });
    }
  }

  private async addTextSection(
    out: PDFDocument,
    font: any,
    title: string,
    text: string,
  ) {
    const pageSize: [number, number] = [595.28, 841.89]; // A4
    const margin = 50;
    const fontSizeTitle = 16;
    const fontSize = 11;
    const lineHeight = 14;

    const maxWidth = pageSize[0] - margin * 2;

    const safeText = sanitizeForWinAnsi(text);
    const lines = this.wrapText(safeText, font, fontSize, maxWidth);

    let page = out.addPage(pageSize);
    let y = page.getHeight() - margin;

    // título
    page.drawText(sanitizeForWinAnsi(title), {
      x: margin,
      y,
      size: fontSizeTitle,
      font,
    });
    y -= 26;

    // corpo
    for (const line of lines) {
      if (y <= margin) {
        page = out.addPage(pageSize);
        y = page.getHeight() - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }
  }

  private wrapText(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number,
  ) {
    const paragraphs = text.split('\n');
    const lines: string[] = [];

    for (const p of paragraphs) {
      if (!p.trim()) {
        lines.push('');
        continue;
      }

      const words = p.split(/\s+/);
      let current = '';

      for (const w of words) {
        const candidate = current ? `${current} ${w}` : w;
        const width = font.widthOfTextAtSize(candidate, fontSize);

        if (width <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      }

      if (current) lines.push(current);
    }

    return lines;
  }
}
