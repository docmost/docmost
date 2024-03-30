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
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private userRepo: UserRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('me')
  async getUser(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const user = await this.userRepo.findById(authUser.id, workspace.id);

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    return user;
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getUserIno(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return { user: authUser, workspace };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.userService.update(updateUserDto, user.id, workspace.id);
  }
}
