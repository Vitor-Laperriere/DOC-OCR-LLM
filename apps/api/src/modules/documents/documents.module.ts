import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { DocumentsController } from './presentation/controllers/documents.controller';
import { PrismaDocumentRepository } from './infra/prisma/prisma-document-repository';
import { DOCUMENT_REPOSITORY } from './domain/repositories/document-repository.token';
import { ListDocumentsUseCase } from './application/use-cases/list-documents.usecase';
import { GetDocumentUseCase } from './application/use-cases/get-document.usecase';
import { UploadDocumentUseCase } from './application/use-cases/upload-document.usecase';


@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [
    PrismaDocumentRepository,
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
    ListDocumentsUseCase,
    GetDocumentUseCase,
    UploadDocumentUseCase,
  ],
})
export class DocumentsModule {}
