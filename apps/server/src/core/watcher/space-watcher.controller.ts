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
import { WatcherService } from './watcher.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { SpaceWatcherDto } from './dto/space-watcher.dto';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpaceWatcherController {
  constructor(
    private readonly watcherService: WatcherService,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  private async loadSpaceAndAuthorize(
    spaceId: string,
    user: User,
    workspace: Workspace,
  ) {
    const space = await this.spaceRepo.findById(spaceId, workspace.id);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    return space;
  }

  @HttpCode(HttpStatus.OK)
  @Post('watched-ids')
  async getWatchedSpaceIds(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.watcherService.getWatchedSpaceIds(user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('watch')
  async watchSpace(
    @Body() dto: SpaceWatcherDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);

    await this.watcherService.watchSpace(user.id, space.id, workspace.id);

    return { watching: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('unwatch')
  async unwatchSpace(
    @Body() dto: SpaceWatcherDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);

    await this.watcherService.unwatchSpace(user.id, space.id);

    return { watching: false };
  }

  @HttpCode(HttpStatus.OK)
  @Post('watch-status')
  async getWatchStatus(
    @Body() dto: SpaceWatcherDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.loadSpaceAndAuthorize(dto.spaceId, user, workspace);

    const watching = await this.watcherService.isWatchingSpace(
      user.id,
      space.id,
    );

    return { watching };
  }
}
