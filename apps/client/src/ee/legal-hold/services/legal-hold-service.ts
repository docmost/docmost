import api from "@/lib/api-client";
import { IPagination } from "@/lib/types";
import {
  CreateLegalHoldInput,
  LegalHoldDetail,
  LegalHoldExportView,
  LegalHoldIdInput,
  LegalHoldListItem,
  LegalHoldListParams,
  LegalHoldSearchParams,
  LegalHoldSpaceView,
  LegalHoldUserView,
  PreservedItemDetail,
  PreservedItemIdInput,
  PreservedItemListParams,
  PreservedItemView,
  UpdateLegalHoldInput,
} from "@/ee/legal-hold/types/legal-hold.types";

export async function getLegalHolds(
  params: LegalHoldListParams,
): Promise<IPagination<LegalHoldListItem>> {
  const req = await api.post<IPagination<LegalHoldListItem>>(
    "/legal-holds",
    params,
  );
  return req.data;
}

export async function getLegalHold(
  data: LegalHoldIdInput,
): Promise<LegalHoldDetail> {
  const req = await api.post<LegalHoldDetail>("/legal-holds/info", data);
  return req.data;
}

export async function createLegalHold(
  data: CreateLegalHoldInput,
): Promise<LegalHoldDetail> {
  const req = await api.post<LegalHoldDetail>("/legal-holds/create", data);
  return req.data;
}

export async function updateLegalHold(
  data: UpdateLegalHoldInput,
): Promise<LegalHoldDetail> {
  const req = await api.post<LegalHoldDetail>("/legal-holds/update", data);
  return req.data;
}

export async function releaseLegalHold(
  data: LegalHoldIdInput,
): Promise<LegalHoldDetail> {
  const req = await api.post<LegalHoldDetail>("/legal-holds/release", data);
  return req.data;
}

export async function getPreservedItems(
  params: PreservedItemListParams,
): Promise<IPagination<PreservedItemView>> {
  const req = await api.post<IPagination<PreservedItemView>>(
    "/legal-holds/items",
    params,
  );
  return req.data;
}

export async function getPreservedItem(
  data: PreservedItemIdInput,
): Promise<PreservedItemDetail> {
  const req = await api.post<PreservedItemDetail>(
    "/legal-holds/items/info",
    data,
  );
  return req.data;
}

export async function getLegalHoldExports(
  data: LegalHoldIdInput,
): Promise<LegalHoldExportView[]> {
  const req = await api.post<LegalHoldExportView[]>(
    "/legal-holds/exports",
    data,
  );
  return req.data;
}

export async function createLegalHoldExport(
  data: LegalHoldIdInput,
): Promise<LegalHoldExportView> {
  const req = await api.post<LegalHoldExportView>(
    "/legal-holds/exports/create",
    data,
  );
  return req.data;
}

export async function searchLegalHoldUsers(
  params: LegalHoldSearchParams,
): Promise<IPagination<LegalHoldUserView>> {
  const req = await api.post<IPagination<LegalHoldUserView>>(
    "/legal-holds/users",
    params,
  );
  return req.data;
}

export async function searchLegalHoldSpaces(
  params: LegalHoldSearchParams,
): Promise<IPagination<LegalHoldSpaceView>> {
  const req = await api.post<IPagination<LegalHoldSpaceView>>(
    "/legal-holds/spaces",
    params,
  );
  return req.data;
}
