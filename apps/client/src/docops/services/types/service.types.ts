export type LifecycleState = 'active' | 'deprecated' | 'retired';

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

export interface Service {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  ownerId?: string | null;
  lifecycleState: LifecycleState;
  spaceId?: string | null;
  rootPageId?: string | null;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceListResponse {
  items: Service[];
  total: number;
}

export interface ListServicesParams {
  search?: string;
  domain?: string;
  lifecycleState?: LifecycleState;
  tag?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateServicePayload {
  code: string;
  name: string;
  description?: string;
  domain?: string;
  ownerId?: string;
  lifecycleState?: LifecycleState;
  tags?: string[];
}

export interface UpdateServicePayload {
  name?: string;
  description?: string;
  domain?: string;
  ownerId?: string;
  lifecycleState?: LifecycleState;
  tags?: string[];
}

export interface ChangeRequest {
  id: string;
  title: string;
  description?: string;
  status: CrStatus;
  priority: CrPriority;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  serviceId: string;
  pageId?: string | null;
  requestedById: string;
  implementerId?: string | null;
  approverId?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrListResponse {
  items: ChangeRequest[];
  total: number;
}
