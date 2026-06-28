import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingRepo } from './billing.repo';
import { User } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly billingRepo: BillingRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly environment: EnvironmentService,
  ) {}

  private assertAdmin(user: User, workspaceId: string) {
    const ability = this.workspaceAbility.createForUser(user, {
      id: workspaceId,
    } as any);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  private mapBilling(row: any) {
    return {
      ...row,
      amount: row.amount != null ? Number(row.amount) : null,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      tieredFlatAmount:
        row.tieredFlatAmount != null ? Number(row.tieredFlatAmount) : null,
      tieredUnitAmount:
        row.tieredUnitAmount != null ? Number(row.tieredUnitAmount) : null,
      periodStartAt: row.periodStartAt?.toISOString?.() ?? row.periodStartAt,
      periodEndAt: row.periodEndAt?.toISOString?.() ?? row.periodEndAt,
      cancelAt: row.cancelAt?.toISOString?.() ?? row.cancelAt,
      canceledAt: row.canceledAt?.toISOString?.() ?? row.canceledAt,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
      deletedAt: row.deletedAt?.toISOString?.() ?? row.deletedAt,
    };
  }

  async getInfo(user: User, workspaceId: string) {
    this.assertAdmin(user, workspaceId);
    const billing = await this.billingRepo.findByWorkspaceId(workspaceId);
    if (!billing) {
      throw new NotFoundException('No active subscription');
    }
    return this.mapBilling(billing);
  }

  async getPlans(user: User, workspaceId: string) {
    this.assertAdmin(user, workspaceId);
    if (this.environment.isUnlockEe()) {
      return [];
    }
    return [];
  }

  async checkout(
    user: User,
    workspaceId: string,
    _data: { priceId: string },
  ) {
    this.assertAdmin(user, workspaceId);
    throw new BadRequestException(
      'Billing checkout is not available on self-hosted installations',
    );
  }

  async portal(user: User, workspaceId: string) {
    this.assertAdmin(user, workspaceId);
    throw new BadRequestException(
      'Billing portal is not available on self-hosted installations',
    );
  }
}
