import api from "@/lib/api-client";
import { IAuditLog, IAuditLogParams } from "@/ee/audit/types/audit.types";
import { IPagination } from "@/lib/types";

export async function getAuditLogs(
  params?: IAuditLogParams,
): Promise<IPagination<IAuditLog>> {
  const req = await api.post("/audit", { ...params });
  return req.data;
}

export async function getAuditRetention(): Promise<{ retentionDays: number }> {
  const req = await api.post("/audit/retention");
  return req.data;
}

export async function updateAuditRetention(data: {
  auditRetentionDays: number;
}): Promise<{ retentionDays: number }> {
  const req = await api.post("/audit/retention/update", data);
  return req.data;
}
