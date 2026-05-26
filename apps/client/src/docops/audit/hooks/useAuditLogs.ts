import { useQuery } from "@tanstack/react-query";
import { listAuditLogs, type ListAuditParams } from "../api/audit.api";

export function useAuditLogsQuery(params: ListAuditParams) {
  return useQuery({
    queryKey: ["docops-audit-logs", params],
    queryFn: () => listAuditLogs(params),
    placeholderData: (prev) => prev,
  });
}
