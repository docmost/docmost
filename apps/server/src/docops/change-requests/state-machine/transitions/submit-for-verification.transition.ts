import { TransitionDef, TransitionContext } from '../cr-state.types';

export const submitForVerificationTransition: TransitionDef = {
  from: ['IN_IMPLEMENTATION'],
  to: 'IN_VERIFICATION',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('DEVELOPER') || isAdmin,
};
