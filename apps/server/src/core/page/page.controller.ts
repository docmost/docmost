import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PageService } from './services/page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { PageHistoryIdDto, PageIdDto, PageInfoDto } from './dto/page.dto';
import { PageHistoryService } from './services/page-history.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMember, User, Workspace } from '@docmost/db/types/entity.types';
import { SidebarPageDto } from './dto/sidebar-page.dto';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { RecentPageDto } from './dto/recent-page.dto';
import PageAbilityFactory from '../casl/abilities/page-ability.factory';
import {
  PageCaslAction,
  PageCaslSubject,
} from '../casl/interfaces/page-ability.type';
import { AddPageMembersDto } from './dto/add-page-member.dto';
import { PageMemberService } from './services/page-member.service';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { RemovePageMemberDto } from './dto/remove-page-member.dto';
import { UpdatePageMemberRoleDto } from './dto/update-page-member-role.dto';
import { SpaceRole } from 'src/common/helpers/types/permission';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageMemberService: PageMemberService,
    private readonly pageMemberRepo: PageMemberRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryService: PageHistoryService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAbility: PageAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getPage(@Body() dto: PageInfoDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (
      spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }

    const userPageRoles = await this.pageMemberRepo.getUserPageRoles(
      user.id,
      page.id,
    );

    const userPageRole = findHighestUserSpaceRole(userPageRoles);

    const membership = {
      userId: user.id,
      role: userPageRole,
      permissions: pageAbility.rules,
    };

    return { ...page, membership };
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createPageDto: CreatePageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      createPageDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.create(user.id, workspace.id, createPageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() updatePageDto: UpdatePageDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(updatePageDto.pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      updatePageDto.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(
      user,
      updatePageDto.pageId,
    );

    if (
      spaceAbility.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Edit, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }

    return this.pageService.update(
      updatePageDto.pageId,
      updatePageDto,
      user.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() pageIdDto: PageIdDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(pageIdDto.pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (
      spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Delete, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }
    await this.pageService.forceDelete(pageIdDto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore')
  async restore(@Body() pageIdDto: PageIdDto) {
    //  await this.pageService.restore(deletePageDto.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getPageMembers(
    @Body() pageIdDto: PageIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const ability = await this.pageAbility.createForUser(
      user,
      pageIdDto.pageId,
    );

    if (ability.cannot(PageCaslAction.Read, PageCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.getPageMembers(pageIdDto.pageId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addPageMember(
    @Body() dto: AddPageMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.addMembersToPageBatch(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('recent')
  async getRecentPages(
    @Body() recentPageDto: RecentPageDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const recentPages: { items: Array<any>; meta: any } =
      await this.pageService.getRecentPages(user.id, pagination);

    return {
      items: await Promise.all(
        recentPages.items.map(async (page) => {
          try {
            const pageAbility = await this.pageAbility.createForUser(
              user,
              page.id,
            );
            return pageAbility.can(PageCaslAction.Read, PageCaslSubject.Page)
              ? page
              : null;
          } catch (err) {
            return null;
          }
        }),
      ).then((items) => items.filter(Boolean)),
      meta: recentPages.meta,
    };
  }

  // TODO: scope to workspaces
  @HttpCode(HttpStatus.OK)
  @Post('/history')
  async getPageHistory(
    @Body() dto: PageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(user, page.id);

    if (
      spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }

    return this.pageHistoryService.findHistoryByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/history/info')
  async getPageHistoryInfo(
    @Body() dto: PageHistoryIdDto,
    @AuthUser() user: User,
  ) {
    const history = await this.pageHistoryService.findById(dto.historyId);
    if (!history) {
      throw new NotFoundException('Page history not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      history.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(
      user,
      history.pageId,
    );

    if (
      spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }
    return history;
  }

  @HttpCode(HttpStatus.OK)
  @Post('/sidebar-pages')
  async getSidebarPages(
    @Body() dto: SidebarPageDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      dto.spaceId,
    );
    if (spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    let pageId = null;
    if (dto.pageId) {
      const page = await this.pageRepo.findById(dto.pageId);
      if (page.spaceId !== dto.spaceId) {
        throw new ForbiddenException();
      }
      pageId = page.id;
    }

    const pagesInSpace = await this.pageService.getSidebarPages(
      dto.spaceId,
      pagination,
      pageId,
    );

    if (!pagesInSpace) {
      return;
    }

    return {
      items: await Promise.all(
        pagesInSpace.items.map(async (page) => {
          try {
            const pageAbility = await this.pageAbility.createForUser(
              user,
              page.id,
            );
            return pageAbility.can(PageCaslAction.Read, PageCaslSubject.Page)
              ? page
              : null;
          } catch (err) {
            return null;
          }
        }),
      ).then((items) => items.filter(Boolean)),
      meta: pagesInSpace.meta,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('move')
  async movePage(@Body() dto: MovePageDto, @AuthUser() user: User) {
    const movedPage = await this.pageRepo.findById(dto.pageId);
    if (!movedPage) {
      throw new NotFoundException('Moved page not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      movedPage.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(
      user,
      movedPage.id,
    );

    if (
      spaceAbility.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Move, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }

    return this.pageService.movePage(dto, movedPage);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/breadcrumbs')
  async getPageBreadcrumbs(@Body() dto: PageIdDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const spaceAbility = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
    );
    const pageAbility = await this.pageAbility.createForUser(user, page.id);
    if (
      spaceAbility.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page) &&
      pageAbility.cannot(PageCaslAction.Read, PageCaslSubject.Page)
    ) {
      throw new ForbiddenException();
    }
    return this.pageService.getPageBreadCrumbs(page.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeSpaceMember(
    @Body() dto: RemovePageMemberDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.removeMemberFromPage(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/change-role')
  async updateSpaceMemberRole(
    @Body() dto: UpdatePageMemberRoleDto,
    @AuthUser() user: User,
  ) {
    this.validateIds(dto);

    const ability = await this.pageAbility.createForUser(user, dto.pageId);
    if (ability.cannot(PageCaslAction.Manage, PageCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.pageMemberService.updateSpaceMemberRole(dto);
  }

  validateIds(dto: RemovePageMemberDto | UpdatePageMemberRoleDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }
}
