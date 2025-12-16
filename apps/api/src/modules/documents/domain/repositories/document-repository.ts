import { DocumentStatus } from '@prisma/client';

export type DocumentEntity = {
  id: string;
  ownerId: string;
  status: DocumentStatus;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentDetails = DocumentEntity & {
  ocrText: string | null;
};

export interface DocumentRepository {
  listByOwner(ownerId: string): Promise<DocumentEntity[]>;
  findByIdForOwner(id: string, ownerId: string): Promise<DocumentDetails | null>;

  create(input: {
    ownerId: string;
    status: DocumentStatus;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }): Promise<DocumentEntity>;

  updateStoragePath(id: string, storagePath: string): Promise<DocumentEntity>;
  updateStatus(id: string, status: DocumentStatus): Promise<DocumentEntity>;
  upsertOcrResult(documentId: string, text: string): Promise<void>;
}
