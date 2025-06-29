import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { ShareService } from './share.service';
import {
  CreateShareDto,
  ShareIdDto,
  ShareInfoDto,
  SharePageIdDto,
  SharePasswordDto,
  UpdateShareDto,
} from './dto/share.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { SharePasswordRequiredException } from './exceptions/share-password-required.exception';
import { comparePasswordHash } from '../../common/helpers';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from 'src/common/helpers/types/permission';

@UseGuards(JwtAuthGuard)
@Controller('shares')
export class ShareController {
  constructor(
    private readonly shareService: ShareService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
    private readonly environmentService: EnvironmentService,
    private readonly spaceMemberRepo: SpaceMemberRepo
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getShares(
    @AuthUser() user: User,
    @Body() pagination: PaginationOptions,
  ) {
    return this.shareRepo.getShares(user.id, pagination);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/page-info')
  async getSharedPageInfo(
    @Body() dto: ShareInfoDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!dto.pageId && !dto.shareId) {
      throw new BadRequestException();
    }

    return {
      ...(await this.shareService.getSharedPage(dto, workspace.id)),
      hasLicenseKey:
        Boolean(workspace.licenseKey) ||
        (this.environmentService.isCloud() && workspace.plan === 'business'),
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getShare(@Body() dto: ShareIdDto) {
    const share = await this.shareRepo.findById(dto.shareId, {
      includeSharedPage: true,
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.passwordHash) {
      if (!dto.password) {
        throw new SharePasswordRequiredException(share.key);
      }

      const isValidPassword = await comparePasswordHash(dto.password, share.passwordHash);
      if (!isValidPassword) {
        throw new SharePasswordRequiredException(share.key);
      }
    }

    return share;
  }

  @HttpCode(HttpStatus.OK)
  @Post('/for-page')
  async getShareForPage(
    @Body() dto: SharePageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Shared page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    return this.shareService.getShareForPage(page.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createShareDto: CreateShareDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(createShareDto.pageId);

    if (!page || workspace.id !== page.workspaceId) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    return this.shareService.createShare({
      page,
      authUserId: user.id,
      workspaceId: workspace.id,
      createShareDto,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() updateShareDto: UpdateShareDto, @AuthUser() user: User) {
    const share = await this.shareRepo.findById(updateShareDto.shareId);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const ability = await this.spaceAbility.createForUser(user, share.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    return this.shareService.updateShare(share.id, updateShareDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() shareIdDto: ShareIdDto, @AuthUser() user: User) {
    const share = await this.shareRepo.findById(shareIdDto.shareId);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const ability = await this.spaceAbility.createForUser(user, share.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    await this.shareRepo.deleteShare(share.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/tree')
  async getSharePageTree(
    @Body() dto: ShareIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return {
      ...(await this.shareService.getShareTreeWithPassword(dto.shareId, dto.password, workspace.id)),
      hasLicenseKey:
        Boolean(workspace.licenseKey) ||
        (this.environmentService.isCloud() && workspace.plan === 'business'),
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/set-password')
  async setPassword(@Body() dto: SharePasswordDto, @AuthUser() user: User) {
    const share = await this.shareRepo.findById(dto.shareId);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const ability = await this.spaceAbility.createForUser(user, share.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    await this.shareService.setSharePassword(dto.shareId, dto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/remove-password')
  async removePassword(
    @Body() dto: ShareIdDto,
    @AuthUser() user: User,
  ) {
    const share = await this.shareRepo.findById(dto.shareId);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      share.spaceId,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    // Can created by Reader, but needs Admin permission to remove password to prevent abuse. They still can delete the share which will change the slug
    if (userSpaceRole !== SpaceRole.ADMIN) {
      throw new ForbiddenException();
    }

    await this.shareService.removeSharePassword(dto.shareId);
  }
}
