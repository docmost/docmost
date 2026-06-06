import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizeService } from './organize.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import {
  AddOrganizeEventDto,
  CreateOrganizeTaskDto,
  OrganizeShareTokenDto,
  OrganizeTaskIdDto,
  UpdateOrganizeTaskDto,
} from './dto/organize.dto';

@UseGuards(JwtAuthGuard)
@Controller('organize-tasks')
export class OrganizeController {
  constructor(
    private readonly organizeService: OrganizeService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateOrganizeTaskDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (dto.spaceId) {
      await this.assertCanEditSpace(user, dto.spaceId);
    }
    return this.organizeService.create(user, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() dto: OrganizeTaskIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.getInfo(dto.organizeTaskId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('by-token')
  async byToken(
    @Body() dto: OrganizeShareTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.getByShareToken(dto.shareToken, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateOrganizeTaskDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.update(workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('events')
  async addEvent(
    @Body() dto: AddOrganizeEventDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.addEvent(workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.list(workspace.id, pagination);
  }

  private async assertCanEditSpace(user: User, spaceId: string) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }
}
