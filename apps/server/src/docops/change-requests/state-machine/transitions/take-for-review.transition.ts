import { TransitionDef, TransitionContext } from '../cr-state.types';

export const takeForReviewTransition: TransitionDef = {
  from: ['REQUESTED'],
  to: 'IN_REVIEW',
  requiresReason: false,
  canExecute: ({ userRoles, isAdmin }: TransitionContext) =>
    userRoles.includes('APPROVER') || isAdmin,
};
