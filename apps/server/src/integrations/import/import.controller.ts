import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { FileInterceptor } from '../../common/interceptors/file.interceptor';
import * as bytes from 'bytes';
import * as path from 'path';
import { ImportService } from './services/import.service';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { EnvironmentService } from '../environment/environment.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@Controller()
export class ImportController {
  private readonly logger = new Logger(ImportController.name);

  constructor(
    private readonly importService: ImportService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly environmentService: EnvironmentService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @UseInterceptors(FileInterceptor)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/import')
  async importPage(
    @Req() req: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const validFileExtensions = ['.md', '.html', '.docx', '.pdf'];

    const maxFileSize = bytes('30mb');

    let file = null;
    try {
      file = await req.file({
        limits: { fileSize: maxFileSize, fields: 4, files: 1 },
      });
    } catch (err: any) {
      this.logger.error(err.message);
      if (err?.statusCode === 413) {
        throw new BadRequestException(
          `File too large. Exceeds the 10mb import limit`,
        );
      }
    }

    if (!file) {
      throw new BadRequestException('Failed to upload file');
    }

    if (
      !validFileExtensions.includes(path.extname(file.filename).toLowerCase())
    ) {
      throw new BadRequestException('Invalid import file type.');
    }

    const spaceId = file.fields?.spaceId?.value;

    if (!spaceId) {
      throw new BadRequestException('spaceId is required');
    }

    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const createdPage = await this.importService.importPage(
      file,
      user.id,
      spaceId,
      workspace.id,
    );

    const ext = path.extname(file.filename).toLowerCase();
    const sourceMap: Record<string, string> = {
      '.md': 'markdown',
      '.html': 'html',
      '.docx': 'docx',
      '.pdf': 'pdf',
    };

    if (createdPage) {
      this.auditService.log({
        event: AuditEvent.PAGE_CREATED,
        resourceType: AuditResource.PAGE,
        resourceId: createdPage.id,
        spaceId,
        metadata: {
          source: sourceMap[ext],
          fileName: file.filename,
        },
      });
    }

    return createdPage;
  }

  @UseInterceptors(FileInterceptor)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/import-zip')
  async importZip(
    @Req() req: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const validFileExtensions = ['.zip'];

    const maxFileSize = bytes(this.environmentService.getFileImportSizeLimit());

    let file = null;
    try {
      file = await req.file({
        limits: { fileSize: maxFileSize, fields: 3, files: 1 },
      });
    } catch (err: any) {
      this.logger.error(err.message);
      if (err?.statusCode === 413) {
        throw new BadRequestException(
          `File too large. Exceeds the ${this.environmentService.getFileImportSizeLimit()} import limit`,
        );
      }
    }

    if (!file) {
      throw new BadRequestException('Failed to upload file');
    }

    if (
      !validFileExtensions.includes(path.extname(file.filename).toLowerCase())
    ) {
      throw new BadRequestException('Invalid import file extension.');
    }

    const spaceId = file.fields?.spaceId?.value;
    const source = file.fields?.source?.value;

    const validZipSources = ['generic', 'notion', 'confluence'];
    if (!validZipSources.includes(source)) {
      throw new BadRequestException(
        'Invalid import source. Import source must either be generic, notion or confluence.',
      );
    }

    if (!spaceId) {
      throw new BadRequestException('spaceId is required');
    }

    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    this.auditService.log({
      event: AuditEvent.PAGE_IMPORTED,
      resourceType: AuditResource.PAGE,
      resourceId: spaceId,
      spaceId,
      metadata: {
        fileName: file.filename,
        source,
        spaceId,
      },
    });

    return this.importService.importZip(
      file,
      source,
      user.id,
      spaceId,
      workspace.id,
    );
  }

  @UseInterceptors(FileInterceptor)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('pages/import-files')
  async importFiles(
    @Req() req: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const validFileExtensions = ['.md', '.html'];
    const maxFileSize = bytes(this.environmentService.getFileImportSizeLimit());
    const maxFiles = 200;

    let spaceId: string | undefined;
    const files: Array<{ filename: string; buffer: Buffer }> = [];

    try {
      const parts = req.parts({
        limits: { fileSize: maxFileSize, files: maxFiles, fields: 5 },
      });
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files.push({ filename: part.filename, buffer });
        } else if (part.fieldname === 'spaceId') {
          spaceId = part.value;
        }
      }
    } catch (err: any) {
      this.logger.error(err.message);
      if (err?.statusCode === 413) {
        throw new BadRequestException(
          `File too large. Exceeds the ${this.environmentService.getFileImportSizeLimit()} import limit`,
        );
      }
      throw new BadRequestException('Failed to upload files');
    }

    if (!spaceId) {
      throw new BadRequestException('spaceId is required');
    }

    if (files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const hasPageFile = files.some((f) =>
      validFileExtensions.includes(path.extname(f.filename).toLowerCase()),
    );
    if (!hasPageFile) {
      throw new BadRequestException(
        'At least one .md or .html file is required',
      );
    }

    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const fileTask = await this.importService.importBulkFiles({
      files,
      userId: user.id,
      spaceId,
      workspaceId: workspace.id,
    });

    this.auditService.log({
      event: AuditEvent.PAGE_IMPORTED,
      resourceType: AuditResource.PAGE,
      resourceId: spaceId,
      spaceId,
      metadata: {
        source: 'generic',
        fileCount: files.length,
        fileTaskId: fileTask?.id,
      },
    });

    return fileTask;
  }
}
