import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Injectable()
export class UserService {
  constructor(private userRepo: UserRepo) {}

  async findById(userId: string, workspaceId: string) {
    return this.userRepo.findById(userId, workspaceId);
  }

  async update(
    updateUserDto: UpdateUserDto,
    userId: string,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // preference update
    if (typeof updateUserDto.fullPageWidth !== 'undefined') {
      return this.updateUserPageWidthPreference(
        userId,
        updateUserDto.fullPageWidth,
      );
    }

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.email && user.email != updateUserDto.email) {
      if (await this.userRepo.findByEmail(updateUserDto.email, workspaceId)) {
        throw new BadRequestException('A user with this email already exists');
      }
      user.email = updateUserDto.email;
    }

    if (updateUserDto.avatarUrl) {
      user.avatarUrl = updateUserDto.avatarUrl;
    }

    if (updateUserDto.locale) {
      user.locale = updateUserDto.locale;
    }

    await this.userRepo.updateUser(updateUserDto, userId, workspaceId);
    return user;
  }

  async updateUserPageWidthPreference(userId: string, fullPageWidth: boolean) {
    return this.userRepo.updatePreference(
      userId,
      'fullPageWidth',
      fullPageWidth,
    );
  }
}
