import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { DataSource, EntityManager } from 'typeorm';
import { transactionWrapper } from '../../helpers/db.helper';
import { CreateWorkspaceDto } from '../workspace/dto/create-workspace.dto';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private workspaceService: WorkspaceService,
    private dataSource: DataSource,
  ) {}
  async create(
    createUserDto: CreateUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    let user: User;

    const existingUser: User = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    await transactionWrapper(
      async (manager: EntityManager) => {
        user = plainToInstance(User, createUserDto);
        user.locale = 'en';
        user.lastLoginAt = new Date();
        user.name = createUserDto.email.split('@')[0];

        user = await manager.save(User, user);

        const createWorkspaceDto: CreateWorkspaceDto = {
          name: 'My Workspace',
        };

        await this.workspaceService.createOrJoinWorkspace(
          user.id,
          createWorkspaceDto,
          manager,
        );
      },
      this.dataSource,
      manager,
    );

    return user;
  }

  async getUserInstance(userId: string) {
    const user: User = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let workspace;

    try {
      workspace = await this.workspaceService.getUserCurrentWorkspace(userId);
    } catch (error) {
      //console.log(error);
    }

    return { user, workspace };
  }

  async findById(userId: string) {
    return this.userRepository.findById(userId);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async update(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.email && user.email != updateUserDto.email) {
      if (await this.userRepository.findByEmail(updateUserDto.email)) {
        throw new BadRequestException('A user with this email already exists');
      }
      user.email = updateUserDto.email;
    }

    if (updateUserDto.avatarUrl) {
      user.avatarUrl = updateUserDto.avatarUrl;
    }

    return this.userRepository.save(user);
  }

  async compareHash(
    plainPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, passwordHash);
  }
}
