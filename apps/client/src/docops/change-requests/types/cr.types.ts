export type CrStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'IN_IMPLEMENTATION'
  | 'IN_VERIFICATION'
  | 'PUBLISHED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED';

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
  rowVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  events?: CrEvent[];
  externalRefs?: ExternalRef[];
}

export interface CrEvent {
  id: string;
  changeRequestId: string;
  fromStatus?: string | null;
  toStatus: string;
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
  rowVersion?: number;
}

export interface AddExternalRefPayload {
  changeRequestId: string;
  refType: RefType;
  url: string;
  label?: string;
}
