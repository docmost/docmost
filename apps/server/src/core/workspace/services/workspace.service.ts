import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceUserRepository } from '../repositories/workspace-user.repository';
import { WorkspaceUser } from '../entities/workspace-user.entity';
import { Workspace } from '../entities/workspace.entity';
import { plainToInstance } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { generateHostname } from '../workspace.util';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { SpaceService } from '../../space/space.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private workspaceUserRepository: WorkspaceUserRepository,
    private spaceService: SpaceService,
  ) {}

  async findById(workspaceId: string): Promise<Workspace> {
    return this.workspaceRepository.findById(workspaceId);
  }

  async save(workspace: Workspace) {
    return this.workspaceRepository.save(workspace);
  }

  async createOrJoinWorkspace(userId) {
    // context:
    // only create workspace if it is not a signup to an existing workspace
    // OS version is limited to one workspace.
    // if there is no existing workspace, create a new workspace
    // and make first user owner/admin

    // check if workspace already exists in the db
    // if not create default, if yes add the user to existing workspace if signup is open.
    const workspaceCount = await this.workspaceRepository.count();

    if (workspaceCount === 0) {
      // create first workspace
      // add user to workspace as admin

      const newWorkspace = await this.create(userId);
      await this.addUserToWorkspace(userId, newWorkspace.id, 'owner');

      // maybe create default space and add user to it too.
      const newSpace = await this.spaceService.create(userId, newWorkspace.id);
      await this.spaceService.addUserToSpace(userId, newSpace.id, 'owner');
    } else {
      //TODO: accept role as param
      // if no role is passed use default new member role found in workspace settings

      // fetch the oldest workspace and add user to it
      const firstWorkspace = await this.workspaceRepository.find({
        order: {
          createdAt: 'ASC',
        },
        take: 1,
      });

      await this.addUserToWorkspace(userId, firstWorkspace[0].id, 'member');
      // get workspace
      // if there is a default space, we should add new users to it.
    }
  }

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

    return workspace;
  }

  async update(
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (updateWorkspaceDto.name) {
      workspace.name = updateWorkspaceDto.name;
    }

    if (updateWorkspaceDto.logo) {
      workspace.logo = updateWorkspaceDto.logo;
    }

    return this.workspaceRepository.save(workspace);
  }

  async delete(deleteWorkspaceDto: DeleteWorkspaceDto): Promise<void> {
    const workspace = await this.workspaceRepository.findById(
      deleteWorkspaceDto.workspaceId,
    );
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    //TODO
    // remove all existing users from workspace
    // delete workspace
  }

  async addUserToWorkspace(
    userId: string,
    workspaceId: string,
    role: string,
  ): Promise<WorkspaceUser> {
    const existingWorkspaceUser = await this.workspaceUserRepository.findOne({
      where: { userId: userId, workspaceId: workspaceId },
    });

    if (existingWorkspaceUser) {
      throw new BadRequestException('User already added to this workspace');
    }

    const workspaceUser = new WorkspaceUser();
    workspaceUser.userId = userId;
    workspaceUser.workspaceId = workspaceId;
    workspaceUser.role = role;

    return this.workspaceUserRepository.save(workspaceUser);
  }

  async updateWorkspaceUserRole(
    workspaceUserRoleDto: UpdateWorkspaceUserRoleDto,
    workspaceId: string,
  ) {
    const workspaceUser = await this.workspaceUserRepository.findOne({
      where: { userId: workspaceUserRoleDto.userId, workspaceId: workspaceId },
    });

    if (!workspaceUser) {
      throw new BadRequestException('user is not a member of this workspace');
    }

    if (workspaceUser.role === workspaceUserRoleDto.role) {
      return workspaceUser;
    }

    workspaceUser.role = workspaceUserRoleDto.role;
    // TODO: if there is only one workspace owner, prevent the role change

    return this.workspaceUserRepository.save(workspaceUser);
  }

  async removeUserFromWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.validateWorkspaceMember(userId, workspaceId);

    await this.workspaceUserRepository.delete({
      userId,
      workspaceId,
    });
  }

  async getUserCurrentWorkspace(userId: string): Promise<Workspace> {
    // TODO: use workspaceId and fetch workspace based on the id
    // we currently assume the user belongs to one workspace
    const userWorkspace = await this.workspaceUserRepository.findOne({
      where: { userId: userId },
      relations: ['workspace'],
    });

    if (!userWorkspace) {
      throw new NotFoundException('No workspace found for this user');
    }

    return userWorkspace.workspace;
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const workspaces = await this.workspaceUserRepository.find({
      where: { userId: userId },
      relations: ['workspace'],
    });

    return workspaces.map(
      (userWorkspace: WorkspaceUser) => userWorkspace.workspace,
    );
  }

  async getWorkspaceUsers(workspaceId: string) {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: ['workspaceUsers', 'workspaceUsers.user'],
    });

    if (!workspace) {
      throw new BadRequestException('Invalid workspace');
    }

    const users = workspace.workspaceUsers.map((workspaceUser) => {
      workspaceUser.user.password = '';
      return {
        ...workspaceUser.user,
        workspaceRole: workspaceUser.role,
      };
    });

    return { users };
  }

  async validateWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const workspaceUser = await this.workspaceUserRepository.findOne({
      where: { userId, workspaceId },
    });

    if (!workspaceUser) {
      throw new BadRequestException('User is not a member of this workspace');
    }
  }
}
