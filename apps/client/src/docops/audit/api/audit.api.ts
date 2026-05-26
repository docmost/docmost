import api from "@/lib/api-client";

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity_kind: string;
  entity_id: string;
  ip: string | null;
  user_agent: string | null;
  payload_diff: Record<string, any> | null;
  created_at: string;
}

export interface ListAuditParams {
  actorId?: string;
  action?: string;
  entityKind?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditListResponse {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export async function listAuditLogs(params: ListAuditParams): Promise<AuditListResponse> {
  const res = await api.post("/docops/audit", params);
  return res.data;
}
