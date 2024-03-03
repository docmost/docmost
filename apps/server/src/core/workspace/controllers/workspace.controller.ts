import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { RemoveWorkspaceUserDto } from '../dto/remove-workspace-user.dto';
import { AddWorkspaceUserDto } from '../dto/add-workspace-user.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { User } from '../../user/entities/user.entity';
import { CurrentWorkspace } from '../../../decorators/current-workspace.decorator';
import { Workspace } from '../entities/workspace.entity';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { WorkspaceUserService } from '../services/workspace-user.service';

@UseGuards(JwtGuard)
@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceUserService: WorkspaceUserService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getUserWorkspaces(
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.workspaceService.getUserWorkspaces(user.id, pagination);
  }

  /*
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createWorkspace(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @AuthUser() user: User,
  ) {
    return this.workspaceService.create(user.id, createWorkspaceDto);
  }
  */

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateWorkspace(
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.workspaceService.update(workspace.id, updateWorkspaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteWorkspace(@Body() deleteWorkspaceDto: DeleteWorkspaceDto) {
    return this.workspaceService.delete(deleteWorkspaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getWorkspaceMembers(
    @Body()
    pagination: PaginationOptions,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.getWorkspaceUsers(
      workspace.id,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addWorkspaceMember(
    @Body() addWorkspaceUserDto: AddWorkspaceUserDto,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.addUserToWorkspace(
      addWorkspaceUserDto.userId,
      workspace.id,
      addWorkspaceUserDto.role,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeWorkspaceMember(
    @Body() removeWorkspaceUserDto: RemoveWorkspaceUserDto,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.removeUserFromWorkspace(
      removeWorkspaceUserDto.userId,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/role')
  async updateWorkspaceMemberRole(
    @Body() workspaceUserRoleDto: UpdateWorkspaceUserRoleDto,
    @AuthUser() authUser: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.updateWorkspaceUserRole(
      authUser,
      workspaceUserRoleDto,
      workspace.id,
    );
  }
}
