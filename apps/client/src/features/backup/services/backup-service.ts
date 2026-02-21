import api from "@/lib/api-client";

export type BackupJobStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "canceled";
export type BackupTriggerType = "schedule" | "manual" | "api";

export interface BackupJob {
  id: string;
  workspaceId: string;
  policyId: string | null;
  triggerType: BackupTriggerType;
  triggeredByUserId: string | null;
  status: BackupJobStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: string | null;
  artifactPath: string | null;
  artifactSizeBytes: string | null;
  checksum: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
  triggererName?: string | null;
}

export interface ListBackupJobsResult {
  items: BackupJob[];
  nextCursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Backend wraps responses as { data, success, status }
function unwrap<T>(res: unknown): T {
  const obj = res as { data?: T };
  return (obj?.data !== undefined ? obj.data : res) as T;
}

export async function getBackupJobs(params?: {
  cursor?: string;
  limit?: number;
}): Promise<ListBackupJobsResult> {
  const res = await api.get("/backups/jobs", {
    params: { cursor: params?.cursor, limit: params?.limit ?? 20 },
  });
  return unwrap<ListBackupJobsResult>(res);
}

export async function runBackup(): Promise<{ job: BackupJob }> {
  const res = await api.post("/backups/jobs/run");
  return unwrap<{ job: BackupJob }>(res);
}

export async function getBackupDownloadUrl(
  jobId: string,
): Promise<{ url: string }> {
  const res = await api.get(`/backups/jobs/${jobId}/download-url`);
  return unwrap<{ url: string }>(res);
}
