import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PagePermissionService } from './page-permission.service';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PagePermissionController {
  constructor(
    private readonly pagePermissionService: PagePermissionService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('permission-info')
  async permissionInfo(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.getPermissionInfo(
      body.pageId,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('permissions')
  async permissions(
    @Body()
    body: {
      pageId: string;
      cursor?: string;
      beforeCursor?: string;
      limit?: number;
      query?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.getPermissions(body.pageId, user, workspace, {
      cursor: body.cursor,
      beforeCursor: body.beforeCursor,
      limit: body.limit ?? 50,
      query: body.query,
      adminView: false,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('restrict')
  async restrict(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.restrictPage(body.pageId, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove-restriction')
  async removeRestriction(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.removeRestriction(
      body.pageId,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('add-permission')
  async addPermission(
    @Body()
    body: {
      pageId: string;
      role: 'reader' | 'writer';
      userIds?: string[];
      groupIds?: string[];
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.addPermission(body, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove-permission')
  async removePermission(
    @Body()
    body: {
      pageId: string;
      userIds?: string[];
      groupIds?: string[];
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.removePermission(body, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-permission')
  async updatePermission(
    @Body()
    body: {
      pageId: string;
      role: 'reader' | 'writer';
      userId?: string;
      groupId?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pagePermissionService.updatePermissionRole(
      body,
      user,
      workspace,
    );
  }
}
