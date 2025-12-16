import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY } from '../../domain/repositories/document-repository.token';
import type { DocumentRepository, DocumentEntity } from '../../domain/repositories/document-repository';

@Injectable()
export class ListDocumentsUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository,
  ) {}

  execute(ownerId: string): Promise<DocumentEntity[]> {
    return this.repo.listByOwner(ownerId);
  }
}
