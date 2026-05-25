import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { DashboardPeriodDto } from './dto/dashboard-period.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @HttpCode(HttpStatus.OK)
  @Post('overview')
  overview() {
    return this.dashboardService.getOverview();
  }

  @HttpCode(HttpStatus.OK)
  @Post('cr-stats')
  crStats(@Body() dto: DashboardPeriodDto) {
    return this.dashboardService.getCrStats(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('my-requests')
  myRequests(@AuthUser() user: User) {
    return this.dashboardService.getMyRequests(user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('export/cr')
  exportCr(@AuthUser() user: User) {
    return this.dashboardService.exportCrCsv(user);
  }
}
