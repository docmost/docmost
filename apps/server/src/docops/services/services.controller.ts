import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DocOpsRoleGuard } from '../../common/guards/docops-role.guard';
import { DocOpsRoles } from '../../common/decorators/docops-roles.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { ImportServicesDto } from './dto/import-services.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // GET /docops/services?search=...&domain=...&tag=...&lifecycleState=...&limit=&offset=
  @Get('/')
  listServices(@Query() dto: ListServicesDto) {
    return this.servicesService.listServices(dto);
  }

  // GET /docops/services/tags
  @Get('tags')
  listTags() {
    return this.servicesService.listTags();
  }

  // GET /docops/services/:code
  @Get(':code')
  getService(@Param('code') code: string) {
    return this.servicesService.getService(code);
  }

  // GET /docops/services/:code/document
  @Get(':code/document')
  getServiceDocument(@Param('code') code: string) {
    return this.servicesService.getServiceDocument(code);
  }

  // POST /docops/services  — ADMIN only
  @UseGuards(DocOpsRoleGuard)
  @DocOpsRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Post('/')
  createService(
    @Body() dto: CreateServiceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.servicesService.createService(dto, user, workspace);
  }

  // PATCH /docops/services/:id  — ADMIN or owner (owner check in service)
  @UseGuards(DocOpsRoleGuard)
  @DocOpsRoles('ADMIN', 'DEVELOPER')
  @Patch(':id')
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @AuthUser() user: User,
  ) {
    return this.servicesService.updateService(id, dto, user);
  }

  // DELETE /docops/services/:id  — ADMIN only (soft delete → retired)
  @UseGuards(DocOpsRoleGuard)
  @DocOpsRoles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  retireService(@Param('id') id: string, @AuthUser() user: User) {
    return this.servicesService.retireService(id, user);
  }

  // POST /docops/services/import  — ADMIN only, bulk JSON
  @UseGuards(DocOpsRoleGuard)
  @DocOpsRoles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post('import')
  importServices(
    @Body() dto: ImportServicesDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.servicesService.importServices(dto, user, workspace);
  }
}
