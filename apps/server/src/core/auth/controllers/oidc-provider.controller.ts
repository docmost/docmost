import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthProviderRepo } from '../../../database/repos/auth-provider/auth-provider.repo';
import { CreateOidcProviderDto, UpdateOidcProviderDto } from '../dto/oidc.dto';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../common/helpers/types/permission';
import { WorkspaceRepo } from '../../../database/repos/workspace/workspace.repo';

@UseGuards(JwtAuthGuard)
@Controller('auth/oidc/provider')
export class OidcProviderController {
  constructor(
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  @Get()
  async getProvider(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.checkPermission(user);
    return this.authProviderRepo.findOidcProvider(workspace.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: CreateOidcProviderDto,
  ) {
    this.checkPermission(user);
    
    const { enforceSso, ...providerData } = dto;
    
    const provider = await this.authProviderRepo.create({
      ...providerData,
      type: 'oidc',
      workspaceId: workspace.id,
      creatorId: user.id,
    });

    if (enforceSso !== undefined) {
      await this.workspaceRepo.updateWorkspace({ enforceSso }, workspace.id);
    }
    
    return provider;
  }

  @Put(':id')
  async updateProvider(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: UpdateOidcProviderDto,
  ) {
    this.checkPermission(user);
    
    const { enforceSso, ...providerData } = dto;
    
    // Remove empty client secret from update data to keep existing secret
    const updateData = { ...providerData };
    if (updateData.oidcClientSecret === '') {
      delete updateData.oidcClientSecret;
    }
    
    const provider = await this.authProviderRepo.update(id, workspace.id, updateData);

    if (enforceSso !== undefined) {
      await this.workspaceRepo.updateWorkspace({ enforceSso }, workspace.id);
    }
    
    return provider;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('id') id: string,
  ) {
    this.checkPermission(user);
    
    await this.authProviderRepo.delete(id, workspace.id);
  }

  private checkPermission(user: User) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only workspace owners and admins can manage OIDC providers');
    }
  }
}
