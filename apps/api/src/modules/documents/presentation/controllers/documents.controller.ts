import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ListDocumentsUseCase } from '../../application/use-cases/list-documents.usecase';
import { GetDocumentUseCase } from '../../application/use-cases/get-document.usecase';
import { UploadDocumentUseCase } from '../../application/use-cases/upload-document.usecase';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly listDocs: ListDocumentsUseCase,
    private readonly getDoc: GetDocumentUseCase,
    private readonly uploadDoc: UploadDocumentUseCase,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.listDocs.execute(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.getDoc.execute(req.user.sub, id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  create(
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(image\/png|image\/jpeg)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadDoc.execute({ ownerId: req.user.sub, file });
  }
}
