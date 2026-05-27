export const CR_STATUSES = [
  'IN_REVIEW',
  'IN_VERIFICATION',
  'IN_PROGRESS',
  'PUBLISHED',
  'CLOSED',
] as const;

export type CrStatus = (typeof CR_STATUSES)[number];

export const CR_ACTIONS = [
  'approve',
  'verify',
  'assign_to_self',
  'publish',
  'close',
] as const;

export type CrAction = (typeof CR_ACTIONS)[number];

export const ACTIVE_STATUSES: CrStatus[] = [
  'IN_REVIEW',
  'IN_VERIFICATION',
  'IN_PROGRESS',
];

export const TERMINAL_STATUSES: CrStatus[] = ['PUBLISHED', 'CLOSED'];

export type CloseReason = 'REJECTED' | 'CANCELLED';

export interface TransitionContext {
  userRoles: string[];
  isAdmin: boolean;
  actorId: string;
  creatorId: string;
  currentStatus: CrStatus;
}

export interface TransitionDef {
  from: CrStatus[];
  to: CrStatus;
  requiresReason: boolean;
  canExecute(ctx: TransitionContext): boolean;
}
