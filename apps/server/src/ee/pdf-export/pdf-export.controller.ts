import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PdfExportService } from './pdf-export.service';
import { TokenService } from '../../core/auth/services/token.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';

@Controller('pdf-export')
export class PdfExportController {
  constructor(
    private readonly pdfExportService: PdfExportService,
    private readonly tokenService: TokenService,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('render')
  async render(@Body() body: { pageId: string; token: string }) {
    const data = await this.pdfExportService.getRenderPayload(
      body.pageId,
      body.token,
    );
    return { data };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('export')
  @RequireFeature(Feature.PDF_EXPORT)
  async export(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(body.pageId);
    if (page) {
      await this.pageAccessService.validateCanView(page, user);
    }
    const { fileTaskId } = await this.pdfExportService.queuePageExport(
      body.pageId,
      user.id,
      workspace.id,
    );
    const downloadToken = await this.tokenService.generatePdfExportDownloadToken(
      fileTaskId,
      workspace.id,
    );
    const renderToken = await this.tokenService.generatePdfRenderToken(
      body.pageId,
      workspace.id,
    );
    return { fileTaskId, downloadToken, renderToken };
  }
}
