import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SearchService } from './search.service.js';
import {
  SearchDTO,
  SearchPublicSpaceDTO,
  SearchShareDTO,
  SearchSuggestionDTO,
} from './dto/search.dto.js';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator.js';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory.js';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type.js';
import { AuthUser } from '../../common/decorators/auth-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { EnvironmentService } from '../../integrations/environment/environment.service.js';
import { ModuleRef } from '@nestjs/core';
import { PublicSpaceService } from '../public-space/public-space.service.js';
import { PageRepo } from '@docmost/db/repos/page/page.repo.js';
import { importEe } from '../../common/helpers/ee-loader.js';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly environmentService: EnvironmentService,
    private readonly publicSpaceService: PublicSpaceService,
    private readonly pageRepo: PageRepo,
    private moduleRef: ModuleRef,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @OAuthScope('read')
  async pageSearch(
    @Body() searchDto: SearchDTO,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    delete searchDto.shareId;

    if (searchDto.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        user,
        searchDto.spaceId,
      );

      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    if (this.environmentService.getSearchDriver() === 'typesense') {
      return this.searchTypesense(searchDto, {
        userId: user.id,
        workspaceId: workspace.id,
      });
    }

    return this.searchService.searchPage(searchDto, {
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('suggest')
  @OAuthScope('read')
  async searchSuggestions(
    @Body() dto: SearchSuggestionDTO,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.searchService.searchSuggestions(dto, user.id, workspace.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('share-search')
  async searchShare(
    @Body() searchDto: SearchShareDTO,
    @AuthWorkspace() workspace: Workspace,
  ) {
    delete searchDto.spaceId;
    if (!searchDto.shareId) {
      throw new BadRequestException('shareId is required');
    }

    if (this.environmentService.getSearchDriver() === 'typesense') {
      return this.searchTypesense(searchDto, {
        workspaceId: workspace.id,
      });
    }

    return this.searchService.searchPage(searchDto, {
      workspaceId: workspace.id,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('public-space-search')
  async searchPublicSpace(
    @Body() searchDto: SearchPublicSpaceDTO,
    @AuthWorkspace() workspace: Workspace,
  ) {
    delete searchDto.spaceId;
    delete searchDto.shareId;
    // Member-facing filters stay internal: creator identities and label
    // taxonomy must not become a grouping oracle on the anonymous surface.
    delete searchDto.creatorId;
    delete searchDto.labelIds;

    const { space } = await this.publicSpaceService.getPublicSpace(
      searchDto.spaceSlug,
      workspace,
    );
    const pages = await this.pageRepo.getSpacePagesExcludingRestricted(
      space.id,
    );
    const publicPageIds = pages.map((page) => page.id);

    if (this.environmentService.getSearchDriver() === 'typesense') {
      return this.searchTypesense(searchDto, {
        workspaceId: workspace.id,
        publicPageIds,
      });
    }

    return this.searchService.searchPage(searchDto, {
      workspaceId: workspace.id,
      publicPageIds,
    });
  }

  async searchTypesense(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
      publicPageIds?: string[];
    },
  ) {
    const { userId, workspaceId, publicPageIds } = opts;
    let TypesenseModule: any;
    try {
      TypesenseModule = await importEe('typesense/services/page-search.service');

      const PageSearchService = this.moduleRef.get(
        TypesenseModule.PageSearchService,
        {
          strict: false,
        },
      );

      return PageSearchService.searchPage(searchParams, {
        userId: userId,
        workspaceId,
        publicPageIds,
      });
    } catch (err) {
      this.logger.debug(
        'Typesense module requested but enterprise module not bundled in this build',
      );
    }

    throw new BadRequestException('Enterprise Typesense search module missing');
  }
}
