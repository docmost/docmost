import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VersionService } from './version.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async getVersion() {
    return this.versionService.getVersion();
  }
}
