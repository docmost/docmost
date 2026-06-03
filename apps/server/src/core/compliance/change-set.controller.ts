import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChangeSetService } from './services/change-set.service';
import { CreateChangeSetDto } from './dto/create-change-set.dto';
import {
  ChangeSetIdDto,
  ChangeSetScopeDto,
  SetChangeLogSettingsDto,
} from './dto/change-set.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('compliance/change-sets')
export class ChangeSetController {
  constructor(private readonly changeSetService: ChangeSetService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateChangeSetDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.changeSetService.create(dto, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @Body() dto: ChangeSetScopeDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.changeSetService.list(dto, pagination, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@Body() dto: ChangeSetIdDto, @AuthUser() user: User) {
    return this.changeSetService.findOne(dto.changeSetId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('settings/get')
  async getSettings(@Body() dto: ChangeSetScopeDto, @AuthUser() user: User) {
    return this.changeSetService.getChangeLogInfo(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('settings/set')
  async setSettings(
    @Body() dto: SetChangeLogSettingsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.changeSetService.setChangeLogSettings(dto, user, workspace.id);
  }
}
