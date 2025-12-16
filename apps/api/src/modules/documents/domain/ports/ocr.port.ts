export type OcrMethod = 'PDF_PARSE' | 'PDF_IMAGE_OCR' | 'IMAGE_OCR';
export const OCR_PORT = 'OCR_PORT';


export type OcrExtractInput = {
  absolutePath: string;
  originalMimeType?: string;
  buffer?: Buffer; // opcional (para pdf-parse)
};

export type OcrExtractOutput = {
  text: string;
  method: OcrMethod;
  meta?: {
    totalPages?: number;
    processedPages?: number;
    truncated?: boolean;
  };
};

export interface OcrPort {
  extractText(input: OcrExtractInput): Promise<OcrExtractOutput>;
}
