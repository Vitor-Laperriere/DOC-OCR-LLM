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
  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<DocumentDetails | null>;

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

  getOcrText(documentId: string): Promise<string | null>;

  getOrCreateChatSession(
    documentId: string,
    userId: string,
  ): Promise<ChatSessionEntity>;

  listChatMessages(
    sessionId: string,
    limit: number,
  ): Promise<ChatMessageEntity[]>;

  createChatMessage(input: {
    sessionId: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
  }): Promise<void>;
}

export type ChatMessageEntity = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: Date;
};

export type ChatSessionEntity = {
  id: string;
  documentId: string;
  userId: string;
};
