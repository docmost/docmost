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
import { ScimTokenService } from './scim-token.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('scim-tokens')
export class ScimTokenController {
  constructor(private readonly scimTokenService: ScimTokenService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @RequireFeature(Feature.SCIM)
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.scimTokenService.list(workspace.id, user, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @RequireFeature(Feature.SCIM)
  async create(
    @Body() body: { name: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.scimTokenService.create(workspace.id, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @RequireFeature(Feature.SCIM)
  async update(
    @Body() body: { tokenId: string; name: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.scimTokenService.update(workspace.id, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  @RequireFeature(Feature.SCIM)
  async revoke(
    @Body() body: { tokenId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.scimTokenService.revoke(workspace.id, user, body.tokenId);
  }
}
