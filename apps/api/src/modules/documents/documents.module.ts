import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { DocumentsController } from './presentation/controllers/documents.controller';

@Module({
  controllers: [DocumentsController],
})
export class DocumentsModule {}
