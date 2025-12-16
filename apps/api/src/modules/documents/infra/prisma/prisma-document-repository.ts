import { PrismaService } from '../../../../infra/prisma/prisma.service';
import { DocumentRepository } from '../../domain/repositories/document-repository';
import { Document } from '../../domain/entities/document';

export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwnerId(ownerId: string): Promise<Document[]> {
    const rows = await this.prisma.document.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(
      (r) => new Document(r.id, r.ownerId, r.status, r.originalName, r.mimeType, r.sizeBytes, r.storagePath, r.createdAt),
    );
  }
}
