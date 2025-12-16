import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type { DocumentRepository } from '../../domain/repositories/document-repository';

@Injectable()
export class ListChatUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
  ) {}

  async execute(input: { ownerId: string; documentId: string }) {
    const doc = await this.repo.findByIdForOwner(input.documentId, input.ownerId);
    if (!doc) throw new NotFoundException('Document not found');

    const session = await this.repo.getOrCreateChatSession(input.documentId, input.ownerId);
    const messages = await this.repo.listChatMessages(session.id, 100);

    return { sessionId: session.id, messages };
  }
}
