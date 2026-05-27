import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CrAction, CrStatus, TransitionContext, TransitionDef } from './cr-state.types';
import { approveTransition } from './transitions/approve.transition';
import { verifyTransition } from './transitions/verify.transition';
import { assignToSelfTransition } from './transitions/assign-to-self.transition';
import { publishTransition } from './transitions/publish.transition';
import { closeTransition } from './transitions/close.transition';

export const CR_STATE_MACHINE: Record<CrAction, TransitionDef> = {
  approve: approveTransition,
  verify: verifyTransition,
  assign_to_self: assignToSelfTransition,
  publish: publishTransition,
  close: closeTransition,
};

export function validateCrTransition(
  action: string,
  ctx: TransitionContext,
  reason?: string,
): void {
  const def = CR_STATE_MACHINE[action as CrAction];
  if (!def) throw new BadRequestException(`Unknown action: ${action}`);

  if (!def.from.includes(ctx.currentStatus)) {
    throw new BadRequestException(
      `Cannot perform '${action}' on a CR in status '${ctx.currentStatus}'`,
    );
  }

  if (def.requiresReason && !reason?.trim()) {
    throw new BadRequestException(`A reason is required for action '${action}'`);
  }

  if (!def.canExecute(ctx)) {
    throw new ForbiddenException(`Insufficient role to perform '${action}'`);
  }
}

export function getTargetStatus(action: CrAction): CrStatus {
  return CR_STATE_MACHINE[action].to;
}
