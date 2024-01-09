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
import { Workspace } from '../workspace/entities/workspace.entity';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private workspaceService: WorkspaceService,
  ) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser: User = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    let user: User = plainToInstance(User, createUserDto);
    user.locale = 'en';
    user.lastLoginAt = new Date();

    user = await this.userRepository.save(user);

    //TODO: only create workspace if it is not a signup to an existing workspace
    await this.workspaceService.create(user.id);

    return user;
  }

  async getUserInstance(userId: string) {
    const user: User = await this.findById(userId);
    const workspace: Workspace =
      await this.workspaceService.getUserCurrentWorkspace(userId);
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
