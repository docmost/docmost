import { TransitionDef, TransitionContext } from '../cr-state.types';

export const verifyTransition: TransitionDef = {
  from: ['IN_VERIFICATION'],
  to: 'IN_PROGRESS',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('TECH_LEAD') || isAdmin,
};
