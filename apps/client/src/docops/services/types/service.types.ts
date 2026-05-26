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
  owner_id?: string | null;
  lifecycle_state: LifecycleState;
  space_id?: string | null;
  root_page_id?: string | null;
  tags: string[];
  created_at?: string;
  updated_at?: string;
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
  service_id: string;
  page_id?: string | null;
  requested_by_id: string;
  implementer_id?: string | null;
  approver_id?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CrListResponse {
  items: ChangeRequest[];
  total: number;
}
