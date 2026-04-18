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
import { BaseViewService } from '../services/base-view.service';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { CreateViewDto } from '../dto/create-view.dto';
import { UpdateViewDto, DeleteViewDto } from '../dto/update-view.dto';
import { BaseIdDto } from '../dto/base.dto';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';

@UseGuards(JwtAuthGuard)
@Controller('bases/views')
export class BaseViewController {
  constructor(
    private readonly baseViewService: BaseViewService,
    private readonly baseRepo: BaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseViewService.create(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseViewService.update(dto, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(
    @Body() dto: DeleteViewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    await this.baseViewService.delete(dto, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() dto: BaseIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseViewService.listByBaseId(dto.baseId, workspace.id);
  }
}
