import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PersonalSpaceService } from './personal-space.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';

@UseGuards(JwtAuthGuard)
@Controller('personal-space')
export class PersonalSpaceController {
  constructor(private readonly personalSpaceService: PersonalSpaceService) {}

  @HttpCode(HttpStatus.OK)
  @Post('info')
  @RequireFeature(Feature.PERSONAL_SPACES)
  async info(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.personalSpaceService.getInfo(user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @RequireFeature(Feature.PERSONAL_SPACES)
  async create(
    @Body() body: { name?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.personalSpaceService.create(user, workspace.id, body);
  }
}
