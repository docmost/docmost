import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { SpaceService } from './space.service';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { CurrentWorkspace } from '../../decorators/current-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';

@UseGuards(JwtGuard)
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  // get all spaces user is a member of
  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getUserSpaces(
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.spaceService.getUserSpacesInWorkspace(user.id, workspace.id);
  }
}
