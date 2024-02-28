import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { FastifyRequest } from 'fastify';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { RemoveWorkspaceUserDto } from '../dto/remove-workspace-user.dto';
import { AddWorkspaceUserDto } from '../dto/add-workspace-user.dto';

@UseGuards(JwtGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @HttpCode(HttpStatus.OK)
  @Post('test')
  async test(
    @Req() req: FastifyRequest,
    //@Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    //const jwtPayload = req['user'];
    // const userId = jwtPayload.sub;
   // return this.workspaceService.createOrJoinWorkspace();
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createWorkspace(
    @Req() req: FastifyRequest,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    const jwtPayload = req['user'];
    const userId = jwtPayload.sub;
    return this.workspaceService.create(userId, createWorkspaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateWorkspace(
    @Req() req: FastifyRequest,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.workspaceService.update(workspaceId, updateWorkspaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteWorkspace(@Body() deleteWorkspaceDto: DeleteWorkspaceDto) {
    return this.workspaceService.delete(deleteWorkspaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Get('members')
  async getWorkspaceMembers(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.workspaceService.getWorkspaceUsers(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addWorkspaceMember(
    @Req() req: FastifyRequest,
    @Body() addWorkspaceUserDto: AddWorkspaceUserDto,
  ) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.workspaceService.addUserToWorkspace(
      addWorkspaceUserDto.userId,
      workspaceId,
      addWorkspaceUserDto.role,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Delete('members/delete')
  async removeWorkspaceMember(
    @Req() req: FastifyRequest,
    @Body() removeWorkspaceUserDto: RemoveWorkspaceUserDto,
  ) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.workspaceService.removeUserFromWorkspace(
      removeWorkspaceUserDto.userId,
      workspaceId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/role')
  async updateWorkspaceMemberRole(
    @Req() req: FastifyRequest,
    @Body() workspaceUserRoleDto: UpdateWorkspaceUserRoleDto,
  ) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.workspaceService.updateWorkspaceUserRole(
      workspaceUserRoleDto,
      workspaceId,
    );
  }
}
