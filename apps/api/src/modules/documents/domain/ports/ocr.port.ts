export const OCR_PORT = 'OCR_PORT';

export interface OcrPort {
  extractText(input: {
    buffer: Buffer;
    absolutePath: string;
    originalMimeType?: string;
  }): Promise<{ text: string; method: 'PDF_PARSE' | 'PDF_IMAGE_OCR' | 'IMAGE_OCR' }>;
}
