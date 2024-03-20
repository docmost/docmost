import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './space.service';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SpaceIdDto } from './dto/space-id.dto';
import { PaginationOptions } from '../../helpers/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getWorkspaceSpaces(
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // TODO: only show spaces user can see. e.g open and private with user being a member
    return this.spaceService.getWorkspaceSpaces(workspace.id, pagination);
  }

  // get all spaces user is a member of
  @HttpCode(HttpStatus.OK)
  @Post('user')
  async getUserSpaces(
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.spaceService.getUserSpaces(user.id, workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getSpaceInfo(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.spaceService.getSpaceInfo(spaceIdDto.spaceId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getSpaceMembers(
    // todo: accept type? users | groups
    @Body() spaceIdDto: SpaceIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.spaceService.getSpaceUsers(
      spaceIdDto.spaceId,
      workspace.id,
      pagination,
    );
  }
}
