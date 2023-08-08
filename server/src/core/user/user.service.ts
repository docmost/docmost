import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { CreateWorkspaceDto } from '../workspace/dto/create-workspace.dto';

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

    //TODO: create workspace if it is not a signup to an existing workspace
    const workspaceDto: CreateWorkspaceDto = {
      name: user.name, // will be better handled
    };

    await this.workspaceService.create(workspaceDto, user.id);

    return user;
  }

  findById(userId: string) {
    return this.userRepository.findById(userId);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  async compareHash(
    plainPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, passwordHash);
  }
}
