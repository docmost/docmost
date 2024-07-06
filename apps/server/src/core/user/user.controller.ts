import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CurrentUserDto } from './dto/current-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @HttpCode(HttpStatus.OK)
  @Get('me')
  async getUserIno(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<CurrentUserDto> {
    // Whenever we are sending user or workspace information to the frontend,
    // we should only send the necessary information and not the entire object.
    // This mitigates the risk of exposing sensitive information.

    return {
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        timezone: authUser.timezone,
        avatarUrl: authUser.avatarUrl,
        workspaceId: authUser.workspaceId,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        logo: workspace.logo,
        oidcEnabled: workspace.oidcEnabled,
        oidcButtonName: workspace.oidcButtonName,
      },
    };
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
