import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { DocumentsController } from './presentation/controllers/documents.controller';
import { PrismaDocumentRepository } from './infra/prisma/prisma-document-repository';
import { DOCUMENT_REPOSITORY } from './domain/repositories/document-repository.token';
import { ListDocumentsUseCase } from './application/use-cases/list-documents.usecase';
import { GetDocumentUseCase } from './application/use-cases/get-document.usecase';
import { UploadDocumentUseCase } from './application/use-cases/upload-document.usecase';
import { OCR_PORT } from './domain/ports/ocr.port';
import { OcrService } from './infra/ocr/ocr.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [
    PrismaDocumentRepository,
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
    ListDocumentsUseCase,
    GetDocumentUseCase,
    UploadDocumentUseCase,
    OcrService,
    { provide: OCR_PORT, useExisting: OcrService },
  ],
})
export class DocumentsModule {}
