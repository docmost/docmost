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
import { BaseRowService } from '../services/base-row.service';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { CreateRowDto } from '../dto/create-row.dto';
import {
  UpdateRowDto,
  DeleteRowDto,
  RowIdDto,
  ListRowsDto,
  ReorderRowDto,
} from '../dto/update-row.dto';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';

@UseGuards(JwtAuthGuard)
@Controller('bases/rows')
export class BaseRowController {
  constructor(
    private readonly baseRowService: BaseRowService,
    private readonly baseRepo: BaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateRowDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseRowService.create(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getRow(@Body() dto: RowIdDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseRowService.getRowInfo(dto.rowId, dto.baseId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateRowDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseRowService.update(dto, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: DeleteRowDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    await this.baseRowService.delete(dto.rowId, dto.baseId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @Body() dto: ListRowsDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseRowService.list(dto, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reorder')
  async reorder(@Body() dto: ReorderRowDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    await this.baseRowService.reorder(dto);
  }
}
