import { TransitionDef, TransitionContext } from '../cr-state.types';

export const closeTransition: TransitionDef = {
  from: ['IN_REVIEW', 'IN_VERIFICATION', 'IN_PROGRESS'],
  to: 'CLOSED',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin, currentStatus }: TransitionContext) => {
    if (isAdmin) return true;
    if (userRoles.includes('APPROVER') && currentStatus === 'IN_REVIEW') return true;
    return false;
  },
};
