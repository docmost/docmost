import { TransitionDef, TransitionContext, CrStatus } from '../cr-state.types';

const ADMIN_ONLY_STATES: CrStatus[] = [
  'IN_REVIEW',
  'APPROVED',
  'IN_IMPLEMENTATION',
  'IN_VERIFICATION',
  'PUBLISHED',
];

export const cancelTransition: TransitionDef = {
  from: ['DRAFT', 'REQUESTED', 'IN_REVIEW', 'APPROVED', 'IN_IMPLEMENTATION', 'IN_VERIFICATION', 'PUBLISHED'],
  to: 'CANCELLED',
  requiresReason: true,
  canExecute: ({ userRoles, isAdmin, actorId, creatorId, currentStatus }: TransitionContext) => {
    if (isAdmin) return true;
    if (ADMIN_ONLY_STATES.includes(currentStatus)) return false;
    return actorId === creatorId && userRoles.includes('PROCESS_OWNER');
  },
};
