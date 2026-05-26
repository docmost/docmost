import { TransitionDef, TransitionContext } from '../cr-state.types';

export const submitTransition: TransitionDef = {
  from: ['DRAFT'],
  to: 'REQUESTED',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('PROCESS_OWNER') || isAdmin,
};
