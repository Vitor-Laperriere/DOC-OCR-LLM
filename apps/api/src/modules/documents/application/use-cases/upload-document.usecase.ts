import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class UploadDocumentUseCase {
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

    await fs.writeFile(absolutePath, file.buffer);
    await this.repo.updateStoragePath(created.id, relativePath);

    // 3) OCR síncrono
    await this.repo.updateStatus(created.id, DocumentStatus.OCR_PROCESSING);

    try {
      const result = await this.ocr.extractText({
        buffer: file.buffer,
        absolutePath,
        originalMimeType: file.mimetype,
      });

      await this.repo.upsertOcrResult(created.id, result.text);
      await this.repo.updateStatus(created.id, DocumentStatus.OCR_DONE);
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

    // Retorna o documento final (sem OCR text; o detalhe entrega)
    const finalDoc = await this.repo.findByIdForOwner(created.id, ownerId);
    // findByIdForOwner retorna DocumentDetails; aqui devolvemos o básico:
    return finalDoc as any;
  }
}
