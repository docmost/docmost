import { Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceUserRepository } from '../repositories/workspace-user.repository';
import { WorkspaceUser } from '../entities/workspace-user.entity';
import { Workspace } from '../entities/workspace.entity';
import { plainToInstance } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { generateHostname } from '../workspace.util';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private workspaceUserRepository: WorkspaceUserRepository,
  ) {}

  async create(
    createWorkspaceDto: CreateWorkspaceDto,
    userId: string,
  ): Promise<Workspace> {
    let workspace: Workspace = plainToInstance(Workspace, createWorkspaceDto);

    workspace.inviteCode = uuid();
    workspace.creatorId = userId;

    if (!workspace.hostname?.trim()) {
      workspace.hostname = generateHostname(createWorkspaceDto.name);
    }

    workspace = await this.workspaceRepository.save(workspace);
    await this.addUserToWorkspace(userId, workspace.id, 'owner');

    return workspace;
  }

  async addUserToWorkspace(
    userId: string,
    workspaceId: string,
    role: string,
  ): Promise<WorkspaceUser> {
    const workspaceUser = new WorkspaceUser();
    workspaceUser.userId = userId;
    workspaceUser.workspaceId = workspaceId;
    workspaceUser.role = role;

    return this.workspaceUserRepository.save(workspaceUser);
  }
}
