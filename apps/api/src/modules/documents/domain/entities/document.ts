export type DocumentStatus = 'UPLOADED' | 'OCR_PROCESSING' | 'OCR_DONE' | 'FAILED';

export class Document {
  constructor(
    readonly id: string,
    readonly ownerId: string,
    readonly status: DocumentStatus,
    readonly originalName: string,
    readonly mimeType: string,
    readonly sizeBytes: number,
    readonly storagePath: string,
    readonly createdAt: Date,
  ) {}
}
