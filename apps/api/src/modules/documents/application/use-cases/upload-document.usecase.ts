import { Inject, Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type { DocumentEntity, DocumentRepository } from '../../domain/repositories/document-repository';

function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  return '';
}

@Injectable()
export class UploadDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
  ) {}

  async execute(input: { ownerId: string; file: Express.Multer.File }): Promise<DocumentEntity> {
    const { ownerId, file } = input;

    // 1) Cria doc com storagePath temporário (schema exige não-null)
    const created = await this.repo.create({
      ownerId,
      status: DocumentStatus.UPLOADED,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: 'PENDING',
    });

    // 2) Salva arquivo com nome baseado no documentId
    const storageDir = path.join(process.cwd(), 'storage');
    await fs.mkdir(storageDir, { recursive: true });

    const ext = extFromMime(file.mimetype) || path.extname(file.originalname) || '';
    const filename = `${created.id}${ext}`;
    const relativePath = path.join('storage', filename);
    const absolutePath = path.join(process.cwd(), relativePath);

    await fs.writeFile(absolutePath, file.buffer);

    // 3) Atualiza storagePath no banco
    const updated = await this.repo.updateStoragePath(created.id, relativePath);

    return updated;
  }
}
