import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @HttpCode(HttpStatus.OK)
  @Post('me')
  async getUser(@AuthUser() authUser: User) {
    const user: User = await this.userService.findById(authUser.id);

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    return user;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() user: User,
  ) {
    return this.userService.update(user.id, updateUserDto);
  }
}
