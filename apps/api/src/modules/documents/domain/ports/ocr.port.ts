export const OCR_PORT = 'OCR_PORT';

export interface OcrPort {
  extractText(input: { mimeType: string; absolutePath: string }): Promise<string>;
}
