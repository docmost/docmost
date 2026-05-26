import { TransitionDef, TransitionContext } from '../cr-state.types';

export const submitTransition: TransitionDef = {
  from: ['DRAFT'],
  to: 'REQUESTED',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin, actorId, creatorId }: TransitionContext) =>
    (actorId === creatorId && userRoles.includes('PROCESS_OWNER')) || isAdmin,
};
