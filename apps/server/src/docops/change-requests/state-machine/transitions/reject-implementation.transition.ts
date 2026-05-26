import { TransitionDef, TransitionContext } from '../cr-state.types';

export const rejectImplementationTransition: TransitionDef = {
  from: ['IN_VERIFICATION'],
  to: 'IN_IMPLEMENTATION',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('TECH_LEAD') || isAdmin,
};
