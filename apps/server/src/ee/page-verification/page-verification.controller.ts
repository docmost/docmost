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
import { PageVerificationService } from './page-verification.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageVerificationController {
  constructor(
    private readonly pageVerificationService: PageVerificationService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('verification-info')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async info(@Body() body: { pageId: string }, @AuthUser() user: User) {
    return this.pageVerificationService.getInfo(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create-verification')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async setup(
    @Body()
    body: {
      pageId: string;
      type?: string;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds: string[];
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pageVerificationService.setup(body, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-verification')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async update(
    @Body()
    body: {
      pageId: string;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds?: string[];
    },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.update(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete-verification')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async remove(@Body() body: { pageId: string }, @AuthUser() user: User) {
    await this.pageVerificationService.remove(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async verify(@Body() body: { pageId: string }, @AuthUser() user: User) {
    await this.pageVerificationService.verify(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('submit-for-approval')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async submitForApproval(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.submitForApproval(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reject-approval')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async rejectApproval(
    @Body() body: { pageId: string; comment?: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.rejectApproval(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-obsolete')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async markObsolete(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
  ) {
    await this.pageVerificationService.markObsolete(body.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verifications')
  @RequireFeature(Feature.PAGE_VERIFICATION)
  async list(
    @Body()
    body: PaginationOptions & {
      spaceIds?: string[];
      verifierId?: string;
      type?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { spaceIds, verifierId, type, ...pagination } = body;
    return this.pageVerificationService.list(
      workspace.id,
      user.id,
      pagination,
      { spaceIds, verifierId, type },
    );
  }
}
