import {
  BadRequestException,
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
import { FastifyReply } from 'fastify';
import { BaseService } from '../services/base.service';
import { BaseCsvExportService } from '../services/base-csv-export.service';
import { BasePageResolverService } from '../services/base-page-resolver.service';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { CreateBaseDto } from '../dto/create-base.dto';
import { UpdateBaseDto } from '../dto/update-base.dto';
import { BaseIdDto } from '../dto/base.dto';
import { ExportBaseCsvDto } from '../dto/export-base.dto';
import { ResolvePagesDto } from '../dto/resolve-pages.dto';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { SpaceIdDto } from '../../space/dto/space-id.dto';
import { PageAccessService } from '../../page/page-access/page-access.service';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

@UseGuards(JwtAuthGuard)
@Controller('bases')
export class BaseController {
  constructor(
    private readonly baseService: BaseService,
    private readonly baseCsvExportService: BaseCsvExportService,
    private readonly basePageResolverService: BasePageResolverService,
    private readonly baseRepo: BaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // One endpoint, two modes:
    //   - parentPageId set → inline embed inside that page. Derive
    //     spaceId/workspaceId from the parent and gate on Edit access
    //     to the parent (same check the editor uses for any other
    //     content the user adds while editing). Seed two extra text
    //     columns + one row so the freshly-inserted base looks like
    //     a typical database on first paint.
    //   - parentPageId unset → standalone base. Gate on space-level
    //     Create, Page (the same check the page controller uses for
    //     its own create endpoint).
    if (dto.parentPageId) {
      const parent = await this.pageRepo.findById(dto.parentPageId);
      if (!parent) {
        throw new NotFoundException('Parent page not found');
      }
      await this.pageAccessService.validateCanEdit(parent, user);

      return this.baseService.create(
        user.id,
        parent.workspaceId,
        {
          ...dto,
          spaceId: parent.spaceId,
        },
        { extraTextProperties: 2, defaultRows: 1 },
      );
    }

    if (!dto.spaceId) {
      throw new BadRequestException('spaceId or parentPageId is required');
    }

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.baseService.create(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getBase(@Body() dto: BaseIdDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.pageId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.pageAccessService.validateCanView(base, user);

    return this.baseService.getBaseInfo(dto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateBaseDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.pageId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.pageAccessService.validateCanEdit(base, user);

    return this.baseService.update(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: BaseIdDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.pageId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.pageAccessService.validateCanEdit(base, user);

    await this.baseService.delete(dto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() dto: SpaceIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    // Same Page-subject check the page controller's list-equivalents
    // use; a base is a page (isBase=true) so reader access aligns.
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const result = await this.baseService.listBySpaceId(dto.spaceId, pagination);
    const accessible = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: result.items.map((b) => b.id),
      userId: user.id,
    });
    const accessibleSet = new Set(accessible);
    return {
      ...result,
      items: result.items.filter((b) => accessibleSet.has(b.id)),
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('export-csv')
  async exportCsv(
    @Body() dto: ExportBaseCsvDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    const base = await this.baseRepo.findById(dto.pageId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.pageAccessService.validateCanView(base, user);

    await this.baseCsvExportService.streamBaseAsCsv(
      dto.pageId,
      workspace.id,
      res,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/expand')
  async resolvePages(
    @Body() dto: ResolvePagesDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const items = await this.basePageResolverService.resolvePages(
      dto.pageIds,
      workspace.id,
      user.id,
    );
    return { items };
  }

}
