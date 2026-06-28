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
import { BillingService } from './billing.service';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.billingService.getInfo(user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('plans')
  async plans(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.billingService.getPlans(user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('checkout')
  async checkout(
    @Body() body: { priceId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.billingService.checkout(user, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('portal')
  async portal(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.billingService.portal(user, workspace.id);
  }
}
