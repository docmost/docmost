import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportPageDto, ExportSpaceDto } from './dto/export-dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { FastifyReply } from 'fastify';
import { sanitize } from 'sanitize-filename-ts';
import { getExportExtension } from './utils';
import { getMimeType, getPageTitle } from '../../common/helpers';
import * as path from 'path';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@Controller()
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/export')
  async exportPage(
    @Body() dto: ExportPageDto,
    @AuthUser() user: User,
    @Res() res: FastifyReply,
  ) {
    const page = await this.pageRepo.findById(dto.pageId, {
      includeContent: true,
    });

    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    const zipFileStream = await this.exportService.exportPages(
      dto.pageId,
      dto.format,
      dto.includeAttachments,
      dto.includeChildren,
      user.id,
    );

    this.auditService.log({
      event: AuditEvent.PAGE_EXPORTED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        title: getPageTitle(page.title),
        format: dto.format,
        includeChildren: dto.includeChildren,
        includeAttachments: dto.includeAttachments,
        spaceId: page.spaceId,
      },
    });

    const fileName = sanitize(page.title || 'untitled') + '.zip';

    res.headers({
      'Content-Type': 'application/zip',
      'Content-Disposition':
        'attachment; filename="' + encodeURIComponent(fileName) + '"',
    });

    res.send(zipFileStream);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('spaces/export')
  async exportSpace(
    @Body() dto: ExportSpaceDto,
    @AuthUser() user: User,
    @Res() res: FastifyReply,
  ) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    const exportFile = await this.exportService.exportSpace(
      dto.spaceId,
      dto.format,
      dto.includeAttachments,
      user.id,
    );

    this.auditService.log({
      event: AuditEvent.SPACE_EXPORTED,
      resourceType: AuditResource.SPACE,
      resourceId: dto.spaceId,
      spaceId: dto.spaceId,
      metadata: {
        format: dto.format,
        includeAttachments: dto.includeAttachments ?? false,
        spaceName: exportFile.spaceName,
      },
    });

    res.headers({
      'Content-Type': 'application/zip',
      'Content-Disposition':
        'attachment; filename="' +
        encodeURIComponent(sanitize(exportFile.fileName)) +
        '"',
    });

    res.send(exportFile.fileStream);
  }
}
