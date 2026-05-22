import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FavoriteService } from './services/favorite.service';
import { AddFavoriteDto, RemoveFavoriteDto } from './dto/favorite.dto';
import { FavoriteIdsDto } from './dto/favorite-ids.dto';
import { ListFavoritesDto } from './dto/list-favorites.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Page, User, Workspace } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { FavoriteType } from '@docmost/db/repos/favorite/favorite.repo';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoriteController {
  constructor(
    private readonly favoriteService: FavoriteService,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly templateRepo: TemplateRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('add')
  async addFavorite(
    @Body() dto: AddFavoriteDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const resolved = await this.resolveAndValidate(dto, user, workspace.id);

    await this.favoriteService.addFavorite(user.id, workspace.id, {
      type: dto.type,
      pageId: dto.pageId,
      spaceId: dto.type === 'space' ? resolved.spaceId : undefined,
      templateId: dto.templateId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove')
  async removeFavorite(
    @Body() dto: RemoveFavoriteDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.resolveAndValidate(dto, user, workspace.id);

    await this.favoriteService.removeFavorite(user.id, {
      type: dto.type,
      pageId: dto.pageId,
      spaceId: dto.spaceId,
      templateId: dto.templateId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('ids')
  async getFavoriteIds(
    @Body() dto: FavoriteIdsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.favoriteService.getFavoriteIds(
      user.id,
      workspace.id,
      dto.type as FavoriteType,
      dto.spaceId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async getUserFavorites(
    @Body() dto: ListFavoritesDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.favoriteService.getUserFavorites(
      user.id,
      workspace.id,
      pagination,
      dto.type as FavoriteType | undefined,
      dto.spaceId,
    );
  }

  private async resolveAndValidate(
    dto: AddFavoriteDto | RemoveFavoriteDto,
    user: User,
    workspaceId: string,
  ): Promise<{ spaceId: string; page?: Page }> {
    if (dto.type === 'page') {
      if (!dto.pageId) throw new BadRequestException('pageId is required');
      const page = await this.pageRepo.findById(dto.pageId);
      if (!page) throw new NotFoundException('Page not found');
      await this.pageAccessService.validateCanView(page, user);
      return { spaceId: page.spaceId, page };
    }

    if (dto.type === 'space') {
      if (!dto.spaceId) throw new BadRequestException('spaceId is required');
      const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
      if (!space) throw new NotFoundException('Space not found');
      await this.validateSpaceAccess(user.id, space.id);
      return { spaceId: space.id };
    }

    if (dto.type === 'template') {
      if (!dto.templateId)
        throw new BadRequestException('templateId is required');
      const template = await this.templateRepo.findById(
        dto.templateId,
        workspaceId,
      );
      if (!template) throw new NotFoundException('Template not found');
      if (template.spaceId) {
        await this.validateSpaceAccess(user.id, template.spaceId);
      }
      return { spaceId: template.spaceId };
    }

    throw new BadRequestException('Invalid favorite type');
  }

  private async validateSpaceAccess(
    userId: string,
    spaceId: string,
  ): Promise<void> {
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
    if (!userSpaceIds.includes(spaceId)) {
      throw new ForbiddenException();
    }
  }
}
