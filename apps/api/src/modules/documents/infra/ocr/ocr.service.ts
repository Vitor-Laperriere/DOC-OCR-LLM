import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { PDFParse } from 'pdf-parse';
import { fileTypeFromBuffer } from 'file-type';
import { createWorker } from 'tesseract.js';

import type { OcrPort, OcrExtractInput, OcrExtractOutput, OcrMethod } from '../../domain/ports/ocr.port';

const execFileAsync = promisify(execFile);

@Injectable()
export class OcrService implements OcrPort {
  private ocrEngine(): 'native' | 'js' {
    return (process.env.OCR_ENGINE ?? 'native') as 'native' | 'js';
  }

  private ocrLang(): string {
    return process.env.OCR_LANG ?? 'por+eng';
  }

  private minPdfTextChars(): number {
    return Number(process.env.OCR_MIN_PDF_TEXT_CHARS ?? 80);
  }

  private pdfTextBatchPages(): number {
    return Number(process.env.OCR_PDF_TEXT_BATCH_PAGES ?? 10);
  }

  private pdfTextMaxPages(): number {
    return Number(process.env.OCR_PDF_TEXT_MAX_PAGES ?? 80);
  }

  private pdfImageBatchPages(): number {
    return Number(process.env.OCR_PDF_IMAGE_BATCH_PAGES ?? 3);
  }

  private pdfImageMaxPages(): number {
    return Number(process.env.OCR_PDF_IMAGE_MAX_PAGES ?? 30);
  }

  private pdfImageDpi(): number {
    return Number(process.env.OCR_PDF_IMAGE_DPI ?? 250);
  }

  private async detectMimeFromInput(input: OcrExtractInput): Promise<string> {
    if (input.buffer) {
      const ft = await fileTypeFromBuffer(input.buffer);
      return ft?.mime ?? input.originalMimeType ?? 'application/octet-stream';
    }
    return input.originalMimeType ?? 'application/octet-stream';
  }

  private pagesRange(from: number, to: number): number[] {
    const out: number[] = [];
    for (let p = from; p <= to; p++) out.push(p);
    return out;
  }

  private async ocrWithTesseractNative(imagePath: string): Promise<string> {
    const lang = this.ocrLang();
    const { stdout } = await execFileAsync('tesseract', [
      imagePath,
      'stdout',
      '-l',
      lang,
      '--psm',
      '6',
    ]);
    return String(stdout ?? '').trim();
  }

  private async ocrWithTesseractJs(imageBuffer: Buffer): Promise<string> {
    const lang = this.ocrLang();
    const worker = await createWorker(lang);
    try {
      const { data } = await worker.recognize(imageBuffer);
      return (data?.text ?? '').trim();
    } finally {
      await worker.terminate();
    }
  }

  private async pdfParseTextBatched(pdfBuffer: Buffer): Promise<{
    text: string;
    totalPages: number;
    processedPages: number;
    truncated: boolean;
  }> {
    const parser = new PDFParse({ data: pdfBuffer });

    try {
      const info = await parser.getInfo({ parsePageInfo: true });
      const total = Number(info?.total ?? 0);
      const maxPages = Math.min(total || 0, this.pdfTextMaxPages());
      const batch = Math.max(1, this.pdfTextBatchPages());

      let acc = '';
      for (let start = 1; start <= maxPages; start += batch) {
        const end = Math.min(maxPages, start + batch - 1);
        const partial = this.pagesRange(start, end);
        const result = await parser.getText({ partial }); // suporta partial :contentReference[oaicite:4]{index=4}
        const chunk = String(result?.text ?? '').trim();
        if (chunk) {
          acc += `\n\n----- PDF pages ${start}-${end} -----\n${chunk}`;
        }
      }

      return {
        text: acc.trim(),
        totalPages: total,
        processedPages: maxPages,
        truncated: total > 0 ? maxPages < total : false,
      };
    } finally {
      await parser.destroy(); // recomendado para liberar memória :contentReference[oaicite:5]{index=5}
    }
  }

  private async ensureTmpDir(): Promise<string> {
    const tmpDir = path.join(process.cwd(), 'storage', 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    return tmpDir;
  }

  private async pdftoppmToPngRange(pdfPath: string, first: number, last: number, prefix: string): Promise<string[]> {
    const dpi = this.pdfImageDpi();

    // pdftoppm -f X -l Y -png -r DPI input.pdf prefix
    await execFileAsync('pdftoppm', [
      '-f',
      String(first),
      '-l',
      String(last),
      '-png',
      '-r',
      String(dpi),
      pdfPath,
      prefix,
    ]);

    // pdftoppm gera prefix-<page>.png (separador padrão "-") :contentReference[oaicite:6]{index=6}
    const files: string[] = [];
    for (let p = first; p <= last; p++) {
      const candidate = `${prefix}-${p}.png`;
      try {
        await fs.access(candidate);
        files.push(candidate);
      } catch {
        // alguns builds podem usar zero padding; tenta também
        const candidate2 = `${prefix}-${String(p).padStart(2, '0')}.png`;
        await fs.access(candidate2);
        files.push(candidate2);
      }
    }

    return files;
  }

  private async ocrPdfScannedBatched(pdfPath: string, pdfBufferForInfo: Buffer): Promise<{
    text: string;
    totalPages: number;
    processedPages: number;
    truncated: boolean;
  }> {
    // pega total páginas via pdf-parse info (leve) :contentReference[oaicite:7]{index=7}
    const infoParser = new PDFParse({ data: pdfBufferForInfo });
    let totalPages = 0;

    try {
      const info = await infoParser.getInfo({ parsePageInfo: true });
      totalPages = Number(info?.total ?? 0);
    } finally {
      await infoParser.destroy();
    }

    const maxPages = Math.min(totalPages || 0, this.pdfImageMaxPages());
    const batch = Math.max(1, this.pdfImageBatchPages());

    const tmpDir = await this.ensureTmpDir();
    const prefixBase = path.join(tmpDir, `pdf_${Date.now()}_${Math.random().toString(16).slice(2)}`);

    let acc = '';

    for (let start = 1; start <= maxPages; start += batch) {
      const end = Math.min(maxPages, start + batch - 1);

      const prefix = `${prefixBase}_${start}_${end}`;
      const pngPaths = await this.pdftoppmToPngRange(pdfPath, start, end, prefix);

      for (let idx = 0; idx < pngPaths.length; idx++) {
        const pageNum = start + idx;
        const pngPath = pngPaths[idx];

        const text =
          this.ocrEngine() === 'native'
            ? await this.ocrWithTesseractNative(pngPath)
            : await this.ocrWithTesseractJs(await fs.readFile(pngPath));

        if (text) {
          acc += `\n\n----- OCR page ${pageNum} -----\n${text}`;
        }

        // limpeza do PNG para não acumular disco
        try { await fs.unlink(pngPath); } catch {}
      }
    }

    return {
      text: acc.trim(),
      totalPages,
      processedPages: maxPages,
      truncated: totalPages > 0 ? maxPages < totalPages : false,
    };
  }

  async extractText(input: OcrExtractInput): Promise<OcrExtractOutput> {
    const mime = await this.detectMimeFromInput(input);

    // 1) PDF
    if (mime === 'application/pdf') {
      // Para pdf-parse precisamos do buffer. Se não veio, leia do disco.
      const pdfBuffer = input.buffer ?? (await fs.readFile(input.absolutePath));

      // tenta texto “nativo” do PDF, em lotes
      let parsed = { text: '', totalPages: 0, processedPages: 0, truncated: false };
      try {
        parsed = await this.pdfParseTextBatched(pdfBuffer);
      } catch (e: any) {
        console.warn('[OCR] pdf-parse failed; fallback to image OCR:', e?.message);
      }

      if (parsed.text.length >= this.minPdfTextChars()) {
        return {
          text: parsed.text,
          method: 'PDF_PARSE',
          meta: {
            totalPages: parsed.totalPages,
            processedPages: parsed.processedPages,
            truncated: parsed.truncated,
          },
        };
      }

      // fallback: PDF escaneado → render + OCR por lotes
      const scanned = await this.ocrPdfScannedBatched(input.absolutePath, pdfBuffer);
      return {
        text: scanned.text,
        method: 'PDF_IMAGE_OCR',
        meta: {
          totalPages: scanned.totalPages,
          processedPages: scanned.processedPages,
          truncated: scanned.truncated,
        },
      };
    }

    // 2) Imagem
    if (mime.startsWith('image/')) {
      const extracted =
        this.ocrEngine() === 'native'
          ? await this.ocrWithTesseractNative(input.absolutePath)
          : await this.ocrWithTesseractJs(input.buffer ?? (await fs.readFile(input.absolutePath)));

      return { text: extracted, method: 'IMAGE_OCR' };
    }

    throw new Error(`Unsupported file type for OCR: ${mime}`);
  }
}
