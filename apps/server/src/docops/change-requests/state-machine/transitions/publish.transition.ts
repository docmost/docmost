import { TransitionDef, TransitionContext } from '../cr-state.types';

export const publishTransition: TransitionDef = {
  from: ['IN_PROGRESS'],
  to: 'PUBLISHED',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('TECH_LEAD') || userRoles.includes('APPROVER') || isAdmin,
};
