import {
  Controller,
  Post,
  Body,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LicenseService, ILicenseInfo } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { GenerateLicenseDto } from './dto/generate-license.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('info')
  @HttpCode(HttpStatus.OK)
  async getLicenseInfo(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<ILicenseInfo> {
    const licenseInfo = await this.licenseService.getLicenseInfo(workspace.id);

    if (!licenseInfo) {
      throw new NotFoundException('No license found');
    }

    return licenseInfo;
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activateLicense(
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: ActivateLicenseDto,
  ): Promise<ILicenseInfo> {
    return this.licenseService.activateLicense(workspace.id, dto.licenseKey);
  }

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  async removeLicense(@AuthWorkspace() workspace: Workspace): Promise<void> {
    await this.licenseService.removeLicense(workspace.id);
  }

  @Post('generate-demo')
  @HttpCode(HttpStatus.OK)
  async generateDemoKey(): Promise<{ licenseKey: string }> {
    const licenseKey = this.licenseService.generateDemoLicenseKey();
    return { licenseKey };
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateLicenseKey(
    @Body() dto: GenerateLicenseDto,
  ): Promise<{ licenseKey: string }> {
    const licenseKey = this.licenseService.generateLicenseKey(dto);
    return { licenseKey };
  }
}
