export const CR_STATUSES = ['IN_REVIEW', 'IN_VERIFICATION', 'IN_PROGRESS', 'PUBLISHED', 'CLOSED'] as const;
export type CrStatus = typeof CR_STATUSES[number];

export type CloseReason = 'REJECTED' | 'CANCELLED';

export type CrPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CrImpact = 'LOW' | 'MEDIUM' | 'HIGH';
export type RefType = 'PR' | 'COMMIT' | 'TICKET' | 'BUILD';

// From selectAll() via CamelCasePlugin → camelCase
export interface ChangeRequest {
  id: string;
  title: string;
  description?: string | null;
  justification?: string | null;
  status: CrStatus;
  priority: CrPriority;
  impact: CrImpact;
  serviceId: string;
  serviceCode?: string | null;
  pageId?: string | null;
  requestedById: string;
  implementerId?: string | null;
  approverId?: string | null;
  techLeadId?: string | null;
  dueDate?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  closedAt?: string | null;
  closeReason?: CloseReason | null;
  rowVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  events?: CrEvent[];
  externalRefs?: ExternalRef[];
}

export interface CrEvent {
  id: string;
  changeRequestId: string;
  fromStatus?: CrStatus | null;
  toStatus: CrStatus;
  actorId: string;
  reason?: string | null;
  createdAt: string;
}

export interface ExternalRef {
  id: string;
  changeRequestId: string;
  refType: RefType;
  url: string;
  label?: string | null;
  createdById: string;
  createdAt: string;
}

export interface AvailableTransition {
  action: string;
  requiresReason: boolean;
  targetStatus: CrStatus;
}

export interface CrListResponse {
  items: ChangeRequest[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListCrParams {
  serviceId?: string;
  status?: CrStatus;
  priority?: CrPriority;
  requestedById?: string;
  implementerId?: string;
  approverId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCrPayload {
  serviceId: string;
  pageId: string;
  title: string;
  description: string;
  justification: string;
  priority: CrPriority;
  impact: CrImpact;
  dueDate?: string;
}

export interface TransitionCrPayload {
  id: string;
  action: string;
  reason?: string;
  closeReason?: CloseReason;
  rowVersion?: number;
}

export interface AddExternalRefPayload {
  changeRequestId: string;
  refType: RefType;
  url: string;
  label?: string;
}
