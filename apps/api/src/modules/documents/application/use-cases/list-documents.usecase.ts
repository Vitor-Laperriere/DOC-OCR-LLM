import { DocumentRepository } from '../../domain/repositories/document-repository';

export class ListDocumentsUseCase {
  constructor(private readonly repo: DocumentRepository) {}

  async execute(ownerId: string) {
    return this.repo.findByOwnerId(ownerId);
  }
}
