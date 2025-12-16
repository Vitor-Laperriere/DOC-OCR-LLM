import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import * as path from 'node:path';

import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type { DocumentRepository } from '../../domain/repositories/document-repository';
import { PdfAppendixService } from '../../infra/pdf/pdf-appendix.service';

@Injectable()
export class DownloadDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
    private readonly pdf: PdfAppendixService,
  ) {}

  async execute(input: { ownerId: string; documentId: string }) {
    const doc = await this.repo.findByIdForOwner(input.documentId, input.ownerId);
    if (!doc) throw new NotFoundException('Document not found');

    const absolutePath = path.join(process.cwd(), doc.storagePath);

    const ocrText = doc.status === DocumentStatus.OCR_DONE
      ? await this.repo.getOcrText(doc.id)
      : null;

    // pega chat (se existir)
    const session = await this.repo.getOrCreateChatSession(doc.id, input.ownerId);
    const messages = await this.repo.listChatMessages(session.id, 200);

    const pdfBuffer = await this.pdf.generate({
      originalAbsolutePath: absolutePath,
      originalMimeType: doc.mimeType,
      originalName: doc.originalName,
      ocrText,
      chat: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt),
      })),
    });

    const safeBase =
      (doc.originalName || `document_${doc.id}`).replace(/[^\w.\- ]+/g, '_');
    const filename = safeBase.replace(/\.(png|jpe?g|webp|pdf)$/i, '') + '_with_ocr_chat.pdf';

    return { filename, pdfBuffer };
  }
}
