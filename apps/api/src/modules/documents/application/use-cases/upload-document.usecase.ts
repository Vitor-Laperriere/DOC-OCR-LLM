import { Inject, Injectable, Logger } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type {
  DocumentEntity,
  DocumentRepository,
} from '../../domain/repositories/document-repository';
import { OCR_PORT } from '../../domain/ports/ocr.port';
import type { OcrPort } from '../../domain/ports/ocr.port';

function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'application/pdf') return '.pdf';
  return '';
}

// helper: move file when it came from disk storage (optional future-proof)
async function moveFile(src: string, dest: string) {
  try {
    await fs.rename(src, dest);
  } catch (e: any) {
    // cross-device rename fallback
    if (e?.code === 'EXDEV') {
      const data = await fs.readFile(src);
      await fs.writeFile(dest, data);
      await fs.unlink(src);
      return;
    }
    throw e;
  }
}

@Injectable()
export class UploadDocumentUseCase {
  private readonly logger = new Logger(UploadDocumentUseCase.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
    @Inject(OCR_PORT) private readonly ocr: OcrPort,
  ) {}

  async execute(input: {
    ownerId: string;
    file: Express.Multer.File;
  }): Promise<DocumentEntity> {
    const { ownerId, file } = input;

    // 1) Cria doc inicial (precisamos do id para nomear arquivo)
    const created = await this.repo.create({
      ownerId,
      status: DocumentStatus.UPLOADED,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: 'PENDING',
    });

    // 2) Salva arquivo em disco com nome baseado no id
    const storageDir = path.join(process.cwd(), 'storage');
    await fs.mkdir(storageDir, { recursive: true });

    const ext =
      extFromMime(file.mimetype) || path.extname(file.originalname) || '';
    const filename = `${created.id}${ext}`;
    const relativePath = path.join('storage', filename);
    const absolutePath = path.join(process.cwd(), relativePath);

    // Se você estiver em memoryStorage (buffer), salva via writeFile.
    // Se no futuro mudar para diskStorage (file.path), faz move.
    const diskPath = (file as any).path as string | undefined;

    if (diskPath) {
      await moveFile(diskPath, absolutePath);
    } else {
      await fs.writeFile(absolutePath, file.buffer);
    }

    await this.repo.updateStoragePath(created.id, relativePath);

    // 3) OCR síncrono
    await this.repo.updateStatus(created.id, DocumentStatus.OCR_PROCESSING);

    // Regra pragmática: só repassar buffer ao OCR se arquivo for pequeno.
    // Para PDF grande, OCR lê do disco.
    const MAX_OCR_BUFFER_BYTES = 8 * 1024 * 1024; // 8MB (ajuste se quiser)
    const shouldPassBuffer = !!file.buffer && file.size <= MAX_OCR_BUFFER_BYTES;

    try {
      const result = await this.ocr.extractText({
        absolutePath,
        originalMimeType: file.mimetype,
        buffer: shouldPassBuffer ? file.buffer : undefined,
      });

      await this.repo.upsertOcrResult(created.id, result.text);
      await this.repo.updateStatus(created.id, DocumentStatus.OCR_DONE);

      this.logger.log({
        msg: '[OCR] done',
        documentId: created.id,
        method: result.method,
        meta: (result as any).meta,
        bufferUsed: shouldPassBuffer,
      });
    } catch (e: any) {
      console.error('[OCR] failed', {
        documentId: created.id,
        originalName: file.originalname,
        mimetype: file.mimetype,
        storagePath: absolutePath,
        message: e?.message,
        stack: e?.stack,
      });
      await this.repo.updateStatus(created.id, DocumentStatus.FAILED);
    }

    const finalDoc = await this.repo.findByIdForOwner(created.id, ownerId);
    return finalDoc as any;
  }
}
