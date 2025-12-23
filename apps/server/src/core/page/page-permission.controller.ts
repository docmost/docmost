import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PagePermissionService } from './services/page-permission.service';
import {
  AddPagePermissionDto,
  PageIdDto,
  RemovePagePermissionDto,
  RemovePageRestrictionDto,
  RestrictPageDto,
  UpdatePagePermissionRoleDto,
} from './dto/page-permission.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('pages/permissions')
export class PagePermissionController {
  constructor(
    private readonly pagePermissionService: PagePermissionService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('restrict')
  async restrictPage(
    @Body() dto: RestrictPageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pagePermissionService.restrictPage(dto.pageId, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('add')
  async addPagePermission(
    @Body() dto: AddPagePermissionDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    await this.pagePermissionService.addPagePermissions(dto, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove')
  async removePagePermission(
    @Body() dto: RemovePagePermissionDto,
    @AuthUser() user: User,
  ) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }

    await this.pagePermissionService.removePagePermission(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-role')
  async updatePagePermissionRole(
    @Body() dto: UpdatePagePermissionRoleDto,
    @AuthUser() user: User,
  ) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }

    await this.pagePermissionService.updatePagePermissionRole(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('unrestrict')
  async removePageRestriction(
    @Body() dto: RemovePageRestrictionDto,
    @AuthUser() user: User,
  ) {
    await this.pagePermissionService.removePageRestriction(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async getPagePermissions(
    @Body() dto: PageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.pagePermissionService.getPagePermissions(
      dto.pageId,
      user,
      pagination,
    );
  }
}
