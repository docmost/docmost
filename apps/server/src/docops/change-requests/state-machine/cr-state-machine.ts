import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CrAction, TransitionContext, TransitionDef } from './cr-state.types';
import { submitTransition } from './transitions/submit.transition';
import { takeForReviewTransition } from './transitions/take-for-review.transition';
import { approveTransition } from './transitions/approve.transition';
import { rejectTransition } from './transitions/reject.transition';
import { assignToSelfTransition } from './transitions/assign-to-self.transition';
import { submitForVerificationTransition } from './transitions/submit-for-verification.transition';
import { rejectImplementationTransition } from './transitions/reject-implementation.transition';
import { publishTransition } from './transitions/publish.transition';
import { closeTransition } from './transitions/close.transition';
import { cancelTransition } from './transitions/cancel.transition';

export const CR_STATE_MACHINE: Record<CrAction, TransitionDef> = {
  submit: submitTransition,
  take_for_review: takeForReviewTransition,
  approve: approveTransition,
  reject: rejectTransition,
  assign_to_self: assignToSelfTransition,
  submit_for_verification: submitForVerificationTransition,
  reject_implementation: rejectImplementationTransition,
  publish: publishTransition,
  close: closeTransition,
  cancel: cancelTransition,
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

export function getTargetStatus(action: CrAction): string {
  return CR_STATE_MACHINE[action].to;
}
