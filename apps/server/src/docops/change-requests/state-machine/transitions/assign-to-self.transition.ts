import { TransitionDef, TransitionContext } from '../cr-state.types';

export const assignToSelfTransition: TransitionDef = {
  from: ['APPROVED'],
  to: 'IN_IMPLEMENTATION',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('DEVELOPER') || isAdmin,
};
