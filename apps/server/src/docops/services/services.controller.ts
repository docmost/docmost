import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  listServices(@Body() dto: ListServicesDto) {
    return this.servicesService.listServices(dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  createService(
    @Body() dto: CreateServiceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.servicesService.createService(dto, user, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  getService(@Body() body: { id: string }) {
    return this.servicesService.getService(body.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  updateService(@Body() dto: UpdateServiceDto, @AuthUser() user: User) {
    return this.servicesService.updateService(dto, user.id);
  }
}
