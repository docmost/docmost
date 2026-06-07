import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DedupService } from './dedup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { AnalyzeDedupDto, ResolveDedupDto } from './dto/dedup.dto';

@UseGuards(JwtAuthGuard)
@Controller('dedup')
export class DedupController {
  constructor(
    private readonly dedupService: DedupService,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('analyze')
  async analyze(
    @Body() dto: AnalyzeDedupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (dto.spaceId) {
      await this.assertCanReadSpace(user, dto.spaceId);
    }
    return this.dedupService.analyze(workspace.id, dto.spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  async resolve(
    @Body() dto: ResolveDedupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.dedupService.assertResolvable(dto.keepPageId, dto.dropPageIds);

    const dropped: string[] = [];
    for (const pageId of dto.dropPageIds) {
      const page = await this.pageRepo.findById(pageId);
      if (!page || page.deletedAt || page.workspaceId !== workspace.id) {
        throw new NotFoundException(`Page not found: ${pageId}`);
      }
      const ability = await this.spaceAbility.createForUser(user, page.spaceId);
      if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
        throw new ForbiddenException(`Cannot delete page: ${pageId}`);
      }
      // soft-delete only (never hard delete); native history preserves versions
      await this.pageRepo.removePage(pageId, user.id, workspace.id);
      dropped.push(pageId);
    }

    return { keptPageId: dto.keepPageId, dropped, mode: 'soft-delete' };
  }

  private async assertCanReadSpace(user: User, spaceId: string) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }
}
