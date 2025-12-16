import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../../infra/prisma/prisma.service';
import type {
  DocumentEntity,
  DocumentDetails,
  DocumentRepository,
} from '../../domain/repositories/document-repository';

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerId: string): Promise<DocumentEntity[]> {
    return this.prisma.document.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<DocumentDetails | null> {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId },
      include: { ocrResult: true },
    });
    if (!doc) return null;

    const { ocrResult, ...rest } = doc as any;
    return {
      ...rest,
      ocrText: ocrResult?.text ?? null,
    };
  }

  async create(input: {
    ownerId: string;
    status: DocumentStatus;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }): Promise<DocumentEntity> {
    return this.prisma.document.create({ data: input });
  }

  async updateStoragePath(id: string, storagePath: string): Promise<DocumentEntity> {
    return this.prisma.document.update({ where: { id }, data: { storagePath } });
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<DocumentEntity> {
    return this.prisma.document.update({ where: { id }, data: { status } });
  }

  async upsertOcrResult(documentId: string, text: string): Promise<void> {
    await this.prisma.ocrResult.upsert({
      where: { documentId },
      update: { text },
      create: { documentId, text },
    });
  }
}
