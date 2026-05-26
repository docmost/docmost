export const CR_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'IN_REVIEW',
  'APPROVED',
  'IN_IMPLEMENTATION',
  'IN_VERIFICATION',
  'PUBLISHED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const;

export type CrStatus = (typeof CR_STATUSES)[number];

export const CR_ACTIONS = [
  'submit',
  'take_for_review',
  'approve',
  'reject',
  'assign_to_self',
  'submit_for_verification',
  'reject_implementation',
  'publish',
  'close',
  'cancel',
] as const;

export type CrAction = (typeof CR_ACTIONS)[number];

export const ACTIVE_STATUSES: CrStatus[] = [
  'IN_REVIEW',
  'APPROVED',
  'IN_IMPLEMENTATION',
  'IN_VERIFICATION',
];

export const TERMINAL_STATUSES: CrStatus[] = [
  'PUBLISHED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
];

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
