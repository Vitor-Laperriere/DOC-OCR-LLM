import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type { DocumentEntity, DocumentRepository } from '../../domain/repositories/document-repository';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
  ) {}

  async execute(ownerId: string, documentId: string): Promise<DocumentEntity> {
    const doc = await this.repo.findByIdForOwner(documentId, ownerId);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
}
