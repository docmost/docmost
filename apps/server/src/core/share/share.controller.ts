import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { SpaceCaslAction, SpaceCaslSubject, } from '../casl/interfaces/space-ability.type';
import { anonymous } from 'src/common/helpers';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { SpaceService } from '../space/services/space.service';
import { SpaceMemberService } from '../space/services/space-member.service';
import { SpaceIdDto } from '../space/dto/space-id.dto';
import { PageService } from '../page/services/page.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageHistoryService } from '../page/services/page-history.service';
import { PageIdDto, PageInfoDto } from '../page/dto/page.dto';
import { RecentPageDto } from '../page/dto/recent-page.dto';
import { SidebarPageDto } from '../page/dto/sidebar-page.dto';
import { SearchService } from '../search/search.service';
import { SearchDTO } from '../search/dto/search.dto';
import { ExportService } from 'src/integrations/export/export.service';

@Controller('share')
export class ShareController {
  constructor(
    private readonly spaceService: SpaceService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly pageHistoryService: PageHistoryService,
    private readonly searchService: SearchService,
    private readonly exportService: ExportService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('spaces/info')
  async getSpaceInfo(
    @Body() spaceIdDto: SpaceIdDto,
  ) {
    const space = await this.spaceService.getSpaceInfo(spaceIdDto.spaceId);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(anonymous, space.id);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    return {
      ...space,
      membership: {
        userId: anonymous.id,
        role: SpaceRole.READER,
        permissions: ability.rules,
      }
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/info')
  async getPage(@Body() dto: PageInfoDto) {
    const page = await this.pageRepo.findById(dto.pageId, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(anonymous, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return page;
  }
  
  @HttpCode(HttpStatus.OK)
  @Post('pages/recent')
  async getRecentPages(
    @Body() recentPageDto: RecentPageDto,
    @Body() pagination: PaginationOptions,
  ) {
    if (recentPageDto.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        anonymous,
        recentPageDto.spaceId,
      );

      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }

      return this.pageService.getRecentSpacePages(
        recentPageDto.spaceId,
        pagination,
      );
    }

    return this.pageService.getRecentPages(anonymous.id, pagination);
  }
  
  @HttpCode(HttpStatus.OK)
  @Post('pages/sidebar-pages')
  async getSidebarPages(
    @Body() dto: SidebarPageDto,
    @Body() pagination: PaginationOptions,
  ) {
    const ability = await this.spaceAbility.createForUser(anonymous, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
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

    return this.pageService.getSidebarPages(dto.spaceId, pagination, pageId);
  }
  
  @HttpCode(HttpStatus.OK)
  @Post('pages/breadcrumbs')
  async getPageBreadcrumbs(@Body() dto: PageIdDto) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(anonymous, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return this.pageService.getPageBreadCrumbs(page.id);
  }
  
  @HttpCode(HttpStatus.OK)
  @Post('search')
  async pageSearch(@Body() searchDto: SearchDTO) {
    if (searchDto.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        anonymous,
        searchDto.spaceId,
      );

      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }

      return this.searchService.searchPage(searchDto.query, searchDto);
    }

    throw new UnauthorizedException();
  }
}
