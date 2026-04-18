import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BaseService } from '../services/base.service';
import { BaseCsvExportService } from '../services/base-csv-export.service';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { CreateBaseDto } from '../dto/create-base.dto';
import { UpdateBaseDto } from '../dto/update-base.dto';
import { BaseIdDto } from '../dto/base.dto';
import { ExportBaseCsvDto } from '../dto/export-base.dto';
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
import { SpaceIdDto } from '../../space/dto/space-id.dto';

@UseGuards(JwtAuthGuard)
@Controller('bases')
export class BaseController {
  constructor(
    private readonly baseService: BaseService,
    private readonly baseCsvExportService: BaseCsvExportService,
    private readonly baseRepo: BaseRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateBaseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseService.create(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getBase(@Body() dto: BaseIdDto, @AuthUser() user: User) {
    const base = await this.baseService.getBaseInfo(dto.baseId);

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return base;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateBaseDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseService.update(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() dto: BaseIdDto, @AuthUser() user: User) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    await this.baseService.delete(dto.baseId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @Body() dto: SpaceIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    return this.baseService.listBySpaceId(dto.spaceId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('export-csv')
  async exportCsv(
    @Body() dto: ExportBaseCsvDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const ability = await this.spaceAbility.createForUser(user, base.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
      throw new ForbiddenException();
    }

    await this.baseCsvExportService.streamBaseAsCsv(
      dto.baseId,
      workspace.id,
      res,
    );
  }
}
