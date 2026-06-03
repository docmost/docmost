import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import {
  IChangeLogInfo,
  IChangeSet,
  IComplianceScope,
  ICreateChangeSet,
} from "@/features/compliance/types/compliance.types.ts";

export async function createChangeSet(
  data: ICreateChangeSet,
): Promise<IChangeSet> {
  const req = await api.post<IChangeSet>(
    "/compliance/change-sets/create",
    data,
  );
  return req.data;
}

export async function getChangeSets(
  scope: IComplianceScope,
  cursor?: string,
): Promise<IPagination<IChangeSet>> {
  const req = await api.post("/compliance/change-sets/list", {
    ...scope,
    cursor,
  });
  return req.data;
}

export async function getChangeSetById(
  changeSetId: string,
): Promise<IChangeSet> {
  const req = await api.post<IChangeSet>("/compliance/change-sets/info", {
    changeSetId,
  });
  return req.data;
}

export async function getChangeLogInfo(
  scope: IComplianceScope,
): Promise<IChangeLogInfo> {
  const req = await api.post<IChangeLogInfo>(
    "/compliance/change-sets/settings/get",
    scope,
  );
  return req.data;
}

export async function setChangeLogSettings(
  data: IComplianceScope & { enabled: boolean },
): Promise<void> {
  await api.post("/compliance/change-sets/settings/set", data);
}
