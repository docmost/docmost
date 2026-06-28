import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScimProvisioningService } from './scim-provisioning.service';
import { ScimAuthGuard } from './scim-auth.guard';
import { FastifyRequest } from 'fastify';

type ScimRequest = FastifyRequest & { scimWorkspaceId: string };

@UseGuards(ScimAuthGuard)
@Controller('scim/v2')
export class ScimProvisioningController {
  constructor(private readonly scimService: ScimProvisioningService) {}

  @Get('Users')
  listUsers(
    @Req() req: ScimRequest,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listUsers(
      req.scimWorkspaceId,
      Number(startIndex) || 1,
      Number(count) || 100,
    );
  }

  @Get('Users/:id')
  getUser(@Req() req: ScimRequest, @Param('id') id: string) {
    return this.scimService.getUser(req.scimWorkspaceId, id);
  }

  @Post('Users')
  createUser(@Req() req: ScimRequest, @Body() body: Record<string, unknown>) {
    return this.scimService.createUser(req.scimWorkspaceId, body);
  }

  @Put('Users/:id')
  replaceUser(
    @Req() req: ScimRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.scimService.replaceUser(req.scimWorkspaceId, id, body);
  }

  @Delete('Users/:id')
  async deleteUser(@Req() req: ScimRequest, @Param('id') id: string) {
    await this.scimService.deleteUser(req.scimWorkspaceId, id);
    return {};
  }

  @Get('Groups')
  listGroups(
    @Req() req: ScimRequest,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listGroups(
      req.scimWorkspaceId,
      Number(startIndex) || 1,
      Number(count) || 100,
    );
  }

  @Get('Groups/:id')
  getGroup(@Req() req: ScimRequest, @Param('id') id: string) {
    return this.scimService.getGroup(req.scimWorkspaceId, id);
  }

  @Post('Groups')
  createGroup(@Req() req: ScimRequest, @Body() body: Record<string, unknown>) {
    return this.scimService.createGroup(req.scimWorkspaceId, body);
  }

  @Put('Groups/:id')
  replaceGroup(
    @Req() req: ScimRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.scimService.replaceGroup(req.scimWorkspaceId, id, body);
  }

  @Delete('Groups/:id')
  async deleteGroup(@Req() req: ScimRequest, @Param('id') id: string) {
    await this.scimService.deleteGroup(req.scimWorkspaceId, id);
    return {};
  }
}
