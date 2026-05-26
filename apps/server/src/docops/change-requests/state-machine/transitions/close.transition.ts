import { TransitionDef, TransitionContext } from '../cr-state.types';

export const closeTransition: TransitionDef = {
  from: ['PUBLISHED'],
  to: 'CLOSED',
  requiresReason: false,
  canExecute: ({ isAdmin }: TransitionContext) => isAdmin,
};
