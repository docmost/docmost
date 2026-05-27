import { TransitionDef, TransitionContext } from '../cr-state.types';

export const approveTransition: TransitionDef = {
  from: ['IN_REVIEW'],
  to: 'IN_VERIFICATION',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('APPROVER') || isAdmin,
};
