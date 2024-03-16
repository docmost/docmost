import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { transactionWrapper } from '../../../helpers/db.helper';
import { UserRepository } from '../../user/repositories/user.repository';
import { WorkspaceRepository } from '../../workspace/repositories/workspace.repository';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { SpaceService } from '../../space/space.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';

@Injectable()
export class SignupService {
  constructor(
    private userRepository: UserRepository,
    private workspaceRepository: WorkspaceRepository,
    private workspaceService: WorkspaceService,
    private spaceService: SpaceService,
    private dataSource: DataSource,
  ) {}

  prepareUser(createUserDto: CreateUserDto): User {
    const user = new User();
    user.name = createUserDto.name || createUserDto.email.split('@')[0];
    user.email = createUserDto.email.toLowerCase();
    user.password = createUserDto.password;
    user.locale = 'en';
    user.lastLoginAt = new Date();
    return user;
  }

  async createUser(
    createUserDto: CreateUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    return await transactionWrapper(
      async (transactionManager: EntityManager) => {
        let user = this.prepareUser(createUserDto);
        user = await transactionManager.save(user);

        return user;
      },
      this.dataSource,
      manager,
    );
  }

  async signup(
    createUserDto: CreateUserDto,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<User> {
    const userCheck = await this.userRepository.findOneByEmail(
      createUserDto.email,
      workspaceId,
    );
    if (userCheck) {
      throw new BadRequestException('You have an account on this workspace');
    }

    return await transactionWrapper(
      async (manager: EntityManager) => {
        // create user
        const user = await this.createUser(createUserDto, manager);

        // add user to workspace
        await this.workspaceService.addUserToWorkspace(
          user,
          workspaceId,
          undefined,
          manager,
        );
        return user;
      },
      this.dataSource,
      manager,
    );
  }

  async createWorkspace(
    user: User,
    workspaceName,
    manager?: EntityManager,
  ): Promise<Workspace> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        // for cloud
        const workspaceData: CreateWorkspaceDto = {
          name: workspaceName,
          // hostname: '', // generate
        };

        return await this.workspaceService.create(user, workspaceData, manager);
      },
      this.dataSource,
      manager,
    );
  }

  async firstSetup(
    createAdminUserDto: CreateAdminUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        // create user
        const user = await this.createUser(createAdminUserDto, manager);
        await this.createWorkspace(
          user,
          createAdminUserDto.workspaceName,
          manager,
        );
        return user;
      },
      this.dataSource,
      manager,
    );
  }
}
