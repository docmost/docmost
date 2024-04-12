import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SpaceIdDto } from './dto/space-id.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMemberService } from './services/space-member.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AddSpaceMembersDto } from './dto/add-space-members.dto';
import { RemoveSpaceMemberDto } from './dto/remove-space-member.dto';
import { UpdateSpaceMemberRoleDto } from './dto/update-space-member-role.dto';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { UpdateSpaceDto } from './dto/update-space.dto';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpaceController {
  constructor(
    private readonly spaceService: SpaceService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

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

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getSpaceInfo(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    return this.spaceService.getSpaceInfo(spaceIdDto.spaceId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateGroup(
    @Body() updateSpaceDto: UpdateSpaceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      updateSpaceDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
    return this.spaceService.updateSpace(updateSpaceDto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getSpaceMembers(
    @Body() spaceIdDto: SpaceIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.getSpaceMembers(
      spaceIdDto.spaceId,
      workspace.id,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addSpaceMember(
    @Body() dto: AddSpaceMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.addMembersToSpaceBatch(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeSpaceMember(
    @Body() dto: RemoveSpaceMemberDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.removeMemberFromSpace(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/role')
  async updateSpaceMemberRole(
    @Body() dto: UpdateSpaceMemberRoleDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.updateSpaceMemberRole(
      dto,
      user,
      workspace.id,
    );
  }

  validateIds(dto: RemoveSpaceMemberDto | UpdateSpaceMemberRoleDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }
}
