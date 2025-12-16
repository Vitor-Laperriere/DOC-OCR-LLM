import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  @Get()
  list(@Req() req: any) {
    // req.user vem do validate() do JwtStrategy
    return [{ id: 'doc1', ownerId: req.user.sub, status: 'UPLOADED' }];
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return { ok: true, ownerId: req.user.sub, received: body };
  }
}
