import { TransitionDef, TransitionContext } from '../cr-state.types';

export const rejectTransition: TransitionDef = {
  from: ['IN_REVIEW'],
  to: 'REJECTED',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('APPROVER') || isAdmin,
};
