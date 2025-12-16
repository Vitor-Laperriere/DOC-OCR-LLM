import { Document } from '../entities/document';

export interface DocumentRepository {
  findByOwnerId(ownerId: string): Promise<Document[]>;
}
