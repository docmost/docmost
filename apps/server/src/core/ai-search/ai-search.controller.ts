import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '@docmost/db/types/entity.types';
import { Workspace } from '@docmost/db/types/entity.types';
import { AiSearchService } from './services/ai-search.service';
import { SemanticSearchDto, SemanticSearchShareDto } from './dto/semantic-search.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { SpaceCaslAction, SpaceCaslSubject } from '../casl/interfaces/space-ability.type';
import { Public } from '../../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('ai-search')
export class AiSearchController {
  constructor(
    private readonly aiSearchService: AiSearchService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('semantic')
  async semanticSearch(
    @Body() searchDto: SemanticSearchDto,
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

    return this.aiSearchService.semanticSearch(searchDto.query, searchDto, {
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('hybrid')
  async hybridSearch(
    @Body() searchDto: SemanticSearchDto,
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

    return this.aiSearchService.hybridSearch(searchDto.query, searchDto, {
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('semantic-share')
  async semanticSearchShare(
    @Body() searchDto: SemanticSearchShareDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    delete searchDto.spaceId;
    if (!searchDto.shareId) {
      throw new BadRequestException('shareId is required');
    }

    return this.aiSearchService.semanticSearch(searchDto.query, searchDto, {
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('reindex')
  async reindexPages(
    @Body() body: { spaceId?: string; pageIds?: string[] },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (body.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        user,
        body.spaceId,
      );

      if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    return this.aiSearchService.reindexPages({
      workspaceId: workspace.id,
      spaceId: body.spaceId,
      pageIds: body.pageIds,
    });
  }
} 