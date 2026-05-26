import { TransitionDef, TransitionContext } from '../cr-state.types';

export const approveTransition: TransitionDef = {
  from: ['IN_REVIEW'],
  to: 'APPROVED',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('APPROVER') || isAdmin,
};
