import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Post,
  Body,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { User } from './entities/user.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';

@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @HttpCode(HttpStatus.OK)
  @Get('me')
  async getUser(@AuthUser() authUser: User) {
    const user: User = await this.userService.findById(authUser.id);

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    return { user };
  }

  @HttpCode(HttpStatus.OK)
  @Get('info')
  async getUserInfo(@AuthUser() user: User) {
    const data: { workspace: Workspace; user: User } =
      await this.userService.getUserInstance(user.id);

    return data;
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
