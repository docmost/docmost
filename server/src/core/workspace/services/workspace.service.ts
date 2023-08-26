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
    userId: string,
    createWorkspaceDto?: CreateWorkspaceDto,
  ): Promise<Workspace> {
    let workspace: Workspace;

    if (createWorkspaceDto) {
      workspace = plainToInstance(Workspace, createWorkspaceDto);
    } else {
      workspace = new Workspace();
    }

    workspace.inviteCode = uuid();
    workspace.creatorId = userId;

    if (workspace.name && !workspace.hostname?.trim()) {
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

  async findById(workspaceId: string): Promise<Workspace> {
    return await this.workspaceRepository.findById(workspaceId);
  }

  async getUserCurrentWorkspace(
    userId: string,
    workspaceId?: string,
  ): Promise<Workspace> {
    // TODO: use workspaceId and fetch workspace based on the id
    // we currently assume the user belongs to one workspace
    const userWorkspace = await this.workspaceUserRepository.findOne({
      where: { userId: userId },
      relations: ['workspace'],
    });

    return userWorkspace.workspace;
  }

  async userWorkspaces(userId: string): Promise<Workspace[]> {
    const workspaces = await this.workspaceUserRepository.find({
      where: { userId: userId },
      relations: ['workspace'],
    });

    return workspaces.map(
      (userWorkspace: WorkspaceUser) => userWorkspace.workspace,
    );
  }
}
