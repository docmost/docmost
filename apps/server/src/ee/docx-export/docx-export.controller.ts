import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { DocxExportService } from './docx-export.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { FastifyReply } from 'fastify';
import { sanitizeFileName } from '../../common/helpers';

@UseGuards(JwtAuthGuard)
@Controller()
export class DocxExportController {
  constructor(private readonly docxExportService: DocxExportService) {}

  @HttpCode(HttpStatus.OK)
  @Post('docx-export')
  @RequireFeature(Feature.DOCX_EXPORT)
  async export(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @Res() res: FastifyReply,
  ) {
    const buffer = await this.docxExportService.exportPageToDocx(
      body.pageId,
      user,
    );
    const fileName = sanitizeFileName('export.docx', { preserveSpaces: true });
    res.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.send(buffer);
  }
}
