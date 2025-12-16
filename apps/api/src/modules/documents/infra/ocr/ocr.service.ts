import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { OcrPort } from '../../domain/ports/ocr.port';

// pdf-parse (CommonJS-friendly)
const pdfParse = require('pdf-parse');
const execFileAsync = promisify(execFile);

@Injectable()
export class OcrService implements OcrPort {
  private async ocrImageBuffer(buffer: Buffer): Promise<string> {
    // MVP: cria worker por request (mais simples).
    // Depois, se quiser performance, dá para manter um worker singleton.
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(buffer);
      return (data?.text ?? '').trim();
    } finally {
      await worker.terminate();
    }
  }

  private async pdfToPngFirstPage(pdfPath: string): Promise<string> {
    // Converte apenas a 1ª página (MVP)
    const tmpDir = path.join(process.cwd(), 'storage', 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const prefix = path.join(tmpDir, `page_${Date.now()}`);
    // Saída típica: prefix-1.png (ou prefix-01.png dependendo do build)
    // pdftoppm -png input.pdf outputPrefix
    await execFileAsync('pdftoppm', ['-png', '-f', '1', '-l', '1', pdfPath, prefix]);

    // Tenta achar o arquivo gerado
    const candidates = [`${prefix}-1.png`, `${prefix}-01.png`];
    for (const c of candidates) {
      try {
        await fs.access(c);
        return c;
      } catch {}
    }

    // fallback: varrer tmpDir pelo último png gerado (bem pragmático)
    const files = await fs.readdir(tmpDir);
    const pngs = files.filter((f) => f.endsWith('.png')).map((f) => path.join(tmpDir, f));
    if (!pngs.length) throw new Error('pdftoppm did not generate PNG output');
    return pngs[pngs.length - 1];
  }

  async extractText(input: { mimeType: string; absolutePath: string }): Promise<string> {
    const { mimeType, absolutePath } = input;

    if (mimeType.startsWith('image/')) {
      const buffer = await fs.readFile(absolutePath);
      return this.ocrImageBuffer(buffer);
    }

    if (mimeType === 'application/pdf') {
      const pdfBuffer = await fs.readFile(absolutePath);

      // 1) Tenta extrair texto (PDF textual)
      const parsed = await pdfParse(pdfBuffer);
      const extracted = String(parsed?.text ?? '').trim();
      if (extracted.length >= 30) return extracted;

      // 2) Se for PDF escaneado, converter 1ª página e OCR
      // Requer poppler/pdftoppm instalado.
      const pngPath = await this.pdfToPngFirstPage(absolutePath);
      const imgBuffer = await fs.readFile(pngPath);
      return this.ocrImageBuffer(imgBuffer);
    }

    throw new Error(`Unsupported mimeType for OCR: ${mimeType}`);
  }
}
