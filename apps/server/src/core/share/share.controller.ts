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
  CreateSpaceShareDto,
  ShareIdDto,
  ShareInfoDto,
  SharePageIdDto,
  SpaceIdDto,
  SpaceShareInfoDto,
  UpdateShareDto,
  UpdateSpaceShareDto,
} from './dto/share.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { hasLicenseOrEE } from '../../common/helpers';

@UseGuards(JwtAuthGuard)
@Controller('shares')
export class ShareController {
  constructor(
    private readonly shareService: ShareService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
    private readonly environmentService: EnvironmentService,
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
      hasLicenseKey: hasLicenseOrEE({
        licenseKey: workspace.licenseKey,
        isCloud: this.environmentService.isCloud(),
        plan: workspace.plan,
      }),
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
      ...(await this.shareService.getShareTree(dto.shareId, workspace.id)),
      hasLicenseKey: hasLicenseOrEE({
        licenseKey: workspace.licenseKey,
        isCloud: this.environmentService.isCloud(),
        plan: workspace.plan,
      }),
    };
  }

  // Space Share Endpoints

  @HttpCode(HttpStatus.OK)
  @Post('/for-space')
  async getShareForSpace(
    @Body() dto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Share)) {
      throw new ForbiddenException();
    }

    return this.shareService.getSpaceShare(dto.spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/create-space')
  async createSpaceShare(
    @Body() createSpaceShareDto: CreateSpaceShareDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      createSpaceShareDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    return this.shareService.createSpaceShare({
      spaceId: createSpaceShareDto.spaceId,
      authUserId: user.id,
      workspaceId: workspace.id,
      createSpaceShareDto,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('/update-space')
  async updateSpaceShare(
    @Body() updateSpaceShareDto: UpdateSpaceShareDto,
    @AuthUser() user: User,
  ) {
    const share = await this.shareRepo.findById(updateSpaceShareDto.shareId);

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const ability = await this.spaceAbility.createForUser(user, share.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    return this.shareService.updateSpaceShare(share.id, updateSpaceShareDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/delete-space')
  async deleteSpaceShare(@Body() shareIdDto: ShareIdDto, @AuthUser() user: User) {
    const share = await this.shareRepo.findById(shareIdDto.shareId);

    if (!share || share.pageId !== null) {
      throw new NotFoundException('Space share not found');
    }

    const ability = await this.spaceAbility.createForUser(user, share.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    await this.shareRepo.deleteShare(share.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/space-tree')
  async getSpaceShareTree(
    @Body() dto: ShareIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return {
      ...(await this.shareService.getSpaceShareTree(dto.shareId, workspace.id)),
      hasLicenseKey: hasLicenseOrEE({
        licenseKey: workspace.licenseKey,
        isCloud: this.environmentService.isCloud(),
        plan: workspace.plan,
      }),
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/space-page-info')
  async getSharedSpacePageInfo(
    @Body() dto: SpaceShareInfoDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return {
      ...(await this.shareService.getSharedSpacePage(dto, workspace.id)),
      hasLicenseKey: hasLicenseOrEE({
        licenseKey: workspace.licenseKey,
        isCloud: this.environmentService.isCloud(),
        plan: workspace.plan,
      }),
    };
  }
}
