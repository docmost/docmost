import {
  Body,
  Controller,
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
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly workspaceRepo: WorkspaceRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('me')
  async getUserInfo(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const memberCount = await this.workspaceRepo.getActiveUserCount(
      workspace.id,
    );

    const invitationResult = await this.db
      .selectFrom('workspaceInvitations')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('workspaceId', '=', workspace.id)
      .executeTakeFirst();
    const invitationCount = Number(invitationResult?.count ?? 0);

    const { licenseKey, ...rest } = workspace;

    const workspaceInfo = {
      ...rest,
      memberCount,
      invitationCount,
    };

    return { user: authUser, workspace: workspaceInfo };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.userService.update(updateUserDto, user.id, workspace);
  }
}
