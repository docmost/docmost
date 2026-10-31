import {
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VersionService } from './version.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { EnvironmentService } from '../environment/environment.service.js';

@UseGuards(JwtAuthGuard)
@Controller('version')
export class VersionController {
  constructor(
    private readonly versionService: VersionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async getVersion() {
    if (this.environmentService.isCloud()) throw new NotFoundException();
    return this.versionService.getVersion();
  }
}
