import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageVerificationService } from './page-verification.service';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageVerificationController {
  constructor(
    private readonly pageVerificationService: PageVerificationService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('verification-info')
  async info(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.getInfo(body.pageId, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create-verification')
  async create(
    @Body()
    body: {
      pageId: string;
      type?: 'expiring' | 'qms';
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds: string[];
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.createVerification(body, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-verification')
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
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.updateVerification(body, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete-verification')
  async remove(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.deleteVerification(
      body.pageId,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verify(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.verifyPage(body.pageId, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('submit-for-approval')
  async submitForApproval(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.submitForApproval(
      body.pageId,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('reject-approval')
  async rejectApproval(
    @Body() body: { pageId: string; comment?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.rejectApproval(body, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-obsolete')
  async markObsolete(
    @Body() body: { pageId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.markObsolete(
      body.pageId,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('verifications')
  async verifications(
    @Body()
    body: {
      cursor?: string;
      beforeCursor?: string;
      limit?: number;
      query?: string;
      spaceIds?: string[];
      verifierId?: string;
      type?: 'expiring' | 'qms';
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageVerificationService.listVerifications(user, workspace, {
      cursor: body.cursor,
      beforeCursor: body.beforeCursor,
      limit: body.limit ?? 50,
      query: body.query,
      adminView: false,
      spaceIds: body.spaceIds,
      verifierId: body.verifierId,
      type: body.type,
    });
  }
}
