import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
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
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { FastifyReply } from 'fastify';
import { sanitize } from 'sanitize-filename-ts';
import { getExportExtension } from './utils';
import { getMimeType } from '../../common/helpers';
import * as path from 'path';

@Controller()
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
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

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const fileExt = getExportExtension(dto.format);
    const fileName = sanitize(page.title || 'untitled') + fileExt;

    if (dto.includeChildren) {
      const zipFileBuffer = await this.exportService.exportPageWithChildren(
        dto.pageId,
        dto.format,
      );

      const newName = path.parse(fileName).name + '.zip';

      res.headers({
        'Content-Type': 'application/zip',
        'Content-Disposition':
          'attachment; filename="' + encodeURIComponent(newName) + '"',
      });

      res.send(zipFileBuffer);
      return;
    }

    const rawContent = await this.exportService.exportPage(
      dto.format,
      page,
      true,
    );

    res.headers({
      'Content-Type': getMimeType(fileExt),
      'Content-Disposition':
        'attachment; filename="' + encodeURIComponent(fileName) + '"',
    });

    res.send(rawContent);
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
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const exportFile = await this.exportService.exportSpace(
      dto.spaceId,
      dto.format,
      dto.includeAttachments,
    );

    res.headers({
      'Content-Type': 'application/zip',
      'Content-Disposition':
        'attachment; filename="' +
        encodeURIComponent(sanitize(exportFile.fileName)) +
        '"',
    });

    res.send(exportFile.fileBuffer);
  }
}
