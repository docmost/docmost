import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { plainToClass } from 'class-transformer';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private userRepository: UserRepository) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser: User = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const user: User = plainToClass(User, createUserDto);
    user.locale = 'en';
    user.lastLoginAt = new Date();

    return this.userRepository.save(user);
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
