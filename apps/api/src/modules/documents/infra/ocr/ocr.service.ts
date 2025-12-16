import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PDFParse } from 'pdf-parse';

import type { OcrPort } from '../../domain/ports/ocr.port';
import { fileTypeFromBuffer } from 'file-type';

import { createWorker } from 'tesseract.js';

// pdf-parse (CJS)
const execFileAsync = promisify(execFile);

const MIN_PDF_TEXT_CHARS = 40; // ajuste pragmático

@Injectable()
export class OcrService implements OcrPort {
  private ocrEngine(): 'native' | 'js' {
    return (process.env.OCR_ENGINE ?? 'native') as 'native' | 'js';
  }

  private ocrLang(): string {
    // invoices BR: por é bem útil
    return process.env.OCR_LANG ?? 'por+eng';
  }

  private async detectMime(buffer: Buffer, fallback?: string) {
    const ft = await fileTypeFromBuffer(buffer);
    return ft?.mime ?? fallback ?? 'application/octet-stream';
  }

  private async ocrWithTesseractNative(imagePath: string): Promise<string> {
    // tesseract imagem stdout -l por+eng
    // OUTPUTBASE = stdout envia para stdout. :contentReference[oaicite:5]{index=5}
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

  private async pdfFirstPageToPng(pdfPath: string): Promise<string> {
    const tmpDir = path.join(process.cwd(), 'storage', 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const prefix = path.join(tmpDir, `pdf_${Date.now()}`);

    // pdftoppm -f 1 -l 1 -png input.pdf prefix
    // padrão: prefix-1.png / prefix-01.png dependendo do build. :contentReference[oaicite:6]{index=6}
    await execFileAsync('pdftoppm', [
      '-f',
      '1',
      '-l',
      '1',
      '-png',
      pdfPath,
      prefix,
    ]);

    const candidates = [`${prefix}-1.png`, `${prefix}-01.png`];
    for (const c of candidates) {
      try {
        await fs.access(c);
        return c;
      } catch {}
    }

    // fallback: pegar último png criado
    const files = (await fs.readdir(tmpDir))
      .filter((f) => f.endsWith('.png'))
      .map((f) => path.join(tmpDir, f));

    if (!files.length) throw new Error('pdftoppm did not generate PNG');
    return files.sort().at(-1)!;
  }

  async extractText(input: {
    buffer: Buffer;
    absolutePath: string;
    originalMimeType?: string;
  }): Promise<{
    text: string;
    method: 'PDF_PARSE' | 'PDF_IMAGE_OCR' | 'IMAGE_OCR';
  }> {
    const mime = await this.detectMime(input.buffer, input.originalMimeType);

    // 1) PDF
    if (mime === 'application/pdf') {
      let extracted = '';

      try {
        const parser = new PDFParse({ data: input.buffer }); // buffer do PDF
        const result = await parser.getText();
        extracted = String(result?.text ?? '').trim();
        await parser.destroy(); // importante: liberar memória
      } catch (e: any) {
        console.warn(
          '[OCR] PDFParse.getText failed; fallback to image OCR:',
          e?.message,
        );
        extracted = '';
      }

      if (extracted.length >= MIN_PDF_TEXT_CHARS) {
        return { text: extracted, method: 'PDF_PARSE' as const };
      }

      // fallback: PDF escaneado → pdftoppm + OCR
      const pngPath = await this.pdfFirstPageToPng(input.absolutePath);
      // ... segue seu fluxo atual (tesseract nativo ou tesseract.js)

      const pngBuffer = await fs.readFile(pngPath);

      const extractede =
        this.ocrEngine() === 'native'
          ? await this.ocrWithTesseractNative(pngPath)
          : await this.ocrWithTesseractJs(pngBuffer);

      return { text: extractede, method: 'PDF_IMAGE_OCR' };
    }

    // 2) Imagem
    if (mime.startsWith('image/')) {
      const extracted =
        this.ocrEngine() === 'native'
          ? await this.ocrWithTesseractNative(input.absolutePath)
          : await this.ocrWithTesseractJs(input.buffer);

      return { text: extracted, method: 'IMAGE_OCR' };
    }

    throw new Error(`Unsupported file type for OCR: ${mime}`);
  }
}
