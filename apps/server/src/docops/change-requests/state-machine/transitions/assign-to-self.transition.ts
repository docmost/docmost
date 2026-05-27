import { TransitionDef, TransitionContext } from '../cr-state.types';

export const assignToSelfTransition: TransitionDef = {
  from: ['IN_PROGRESS'],
  to: 'IN_PROGRESS',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('DEVELOPER') || isAdmin,
};
