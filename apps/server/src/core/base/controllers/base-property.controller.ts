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
import { BasePropertyService } from '../services/base-property.service';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { CreatePropertyDto } from '../dto/create-property.dto';
import {
  UpdatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
} from '../dto/update-property.dto';
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
@Controller('bases/properties')
export class BasePropertyController {
  constructor(
    private readonly basePropertyService: BasePropertyService,
    private readonly baseRepo: BaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreatePropertyDto,
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

    return this.basePropertyService.create(workspace.id, dto, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdatePropertyDto,
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

    return this.basePropertyService.update(dto, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(
    @Body() dto: DeletePropertyDto,
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

    await this.basePropertyService.delete(dto, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reorder')
  async reorder(
    @Body() dto: ReorderPropertyDto,
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

    await this.basePropertyService.reorder(dto, workspace.id, user.id);
  }
}
