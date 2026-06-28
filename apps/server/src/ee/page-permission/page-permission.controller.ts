import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PagePermissionService } from './page-permission.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PagePermissionController {
  constructor(private readonly pagePermissionService: PagePermissionService) {}

  @HttpCode(HttpStatus.OK)
  @Post('restrict')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async restrict(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pagePermissionService.restrictPage(
      body.pageId,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove-restriction')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async unrestrict(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pagePermissionService.unrestrictPage(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('add-permission')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async addPermission(
    @Body()
    body: {
      pageId: string;
      role: string;
      userIds?: string[];
      groupIds?: string[];
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pagePermissionService.addPermission(body, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove-permission')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async removePermission(
    @Body()
    body: { pageId: string; userIds?: string[]; groupIds?: string[] },
    @AuthUser() user: User,
  ) {
    await this.pagePermissionService.removePermission(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-permission')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async updatePermission(
    @Body()
    body: {
      pageId: string;
      role: string;
      userId?: string;
      groupId?: string;
    },
    @AuthUser() user: User,
  ) {
    await this.pagePermissionService.updatePermissionRole(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('permissions')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async permissions(
    @Body() body: PaginationOptions & { pageId: string },
    @AuthUser() user: User,
  ) {
    const { pageId, ...pagination } = body;
    return this.pagePermissionService.getPermissions(pageId, user, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('permission-info')
  @RequireFeature(Feature.PAGE_PERMISSIONS)
  async permissionInfo(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    return this.pagePermissionService.getRestrictionInfo(body.pageId, user);
  }
}
