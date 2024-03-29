import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { CreateWorkspaceDto } from '../../workspace/dto/create-workspace.dto';
import { SpaceService } from '../../space/services/space.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { GroupUserService } from '../../group/services/group-user.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { User } from '@docmost/db/types/entity.types';

@Injectable()
export class SignupService {
  constructor(
    private userRepo: UserRepo,
    private workspaceService: WorkspaceService,
    private spaceService: SpaceService,
    private groupUserService: GroupUserService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async signup(
    createUserDto: CreateUserDto,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<User> {
    const userCheck = await this.userRepo.findByEmail(
      createUserDto.email,
      workspaceId,
    );

    if (userCheck) {
      throw new BadRequestException(
        'You already have an account on this workspace',
      );
    }

    return await executeTx(
      this.db,
      async (trx) => {
        // create user
        const user = await this.userRepo.insertUser(createUserDto, trx);

        // add user to workspace
        await this.workspaceService.addUserToWorkspace(
          user.id,
          workspaceId,
          undefined,
          trx,
        );

        // add user to default group
        await this.groupUserService.addUserToDefaultGroup(
          user.id,
          workspaceId,
          trx,
        );
        return user;
      },
      trx,
    );
  }

  async createWorkspace(user, workspaceName, trx?: KyselyTransaction) {
    return await executeTx(
      this.db,
      async (trx) => {
        const workspaceData: CreateWorkspaceDto = {
          name: workspaceName,
        };

        return await this.workspaceService.create(user, workspaceData, trx);
      },
      trx,
    );
  }

  async initialSetup(
    createAdminUserDto: CreateAdminUserDto,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        // create user
        const user = await this.userRepo.insertUser(createAdminUserDto, trx);
        await this.createWorkspace(user, createAdminUserDto.workspaceName, trx);
        return user;
      },
      trx,
    );
  }
}
