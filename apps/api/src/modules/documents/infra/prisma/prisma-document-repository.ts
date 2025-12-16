import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../../infra/prisma/prisma.service';
import { DocumentEntity, DocumentRepository } from '../../domain/repositories/document-repository';

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerId: string): Promise<DocumentEntity[]> {
    return this.prisma.document.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<DocumentEntity | null> {
    return this.prisma.document.findFirst({
      where: { id, ownerId },
    });
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
    return this.prisma.document.update({
      where: { id },
      data: { storagePath },
    });
  }
}
