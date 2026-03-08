import api from "@/lib/api-client";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  CreateBaseInput,
  UpdateBaseInput,
  CreatePropertyInput,
  UpdatePropertyInput,
  DeletePropertyInput,
  ReorderPropertyInput,
  CreateRowInput,
  UpdateRowInput,
  DeleteRowInput,
  ReorderRowInput,
  CreateViewInput,
  UpdateViewInput,
  DeleteViewInput,
  UpdatePropertyResult,
} from "@/features/base/types/base.types";
import { IPagination } from "@/lib/types";

// --- Bases ---

export async function createBase(data: CreateBaseInput): Promise<IBase> {
  const req = await api.post<IBase>("/bases/create", data);
  return req.data;
}

export async function getBaseInfo(baseId: string): Promise<IBase> {
  const req = await api.post<IBase>("/bases/info", { baseId });
  return req.data;
}

export async function updateBase(data: UpdateBaseInput): Promise<IBase> {
  const req = await api.post<IBase>("/bases/update", data);
  return req.data;
}

export async function deleteBase(baseId: string): Promise<void> {
  await api.post("/bases/delete", { baseId });
}

export async function listBases(
  spaceId: string,
  params?: { cursor?: string; limit?: number },
): Promise<IPagination<IBase>> {
  const req = await api.post("/bases/list", { spaceId, ...params });
  return req.data;
}

// --- Properties ---

export async function createProperty(
  data: CreatePropertyInput,
): Promise<IBaseProperty> {
  const req = await api.post<IBaseProperty>("/bases/properties/create", data);
  return req.data;
}

export async function updateProperty(
  data: UpdatePropertyInput,
): Promise<UpdatePropertyResult> {
  const req = await api.post<UpdatePropertyResult>(
    "/bases/properties/update",
    data,
  );
  return req.data;
}

export async function deleteProperty(data: DeletePropertyInput): Promise<void> {
  await api.post("/bases/properties/delete", data);
}

export async function reorderProperty(
  data: ReorderPropertyInput,
): Promise<void> {
  await api.post("/bases/properties/reorder", data);
}

// --- Rows ---

export async function createRow(data: CreateRowInput): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/create", data);
  return req.data;
}

export async function getRowInfo(
  rowId: string,
  baseId: string,
): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/info", { rowId, baseId });
  return req.data;
}

export async function updateRow(data: UpdateRowInput): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/update", data);
  return req.data;
}

export async function deleteRow(data: DeleteRowInput): Promise<void> {
  await api.post("/bases/rows/delete", data);
}

export async function listRows(
  baseId: string,
  params?: { viewId?: string; cursor?: string; limit?: number },
): Promise<IPagination<IBaseRow>> {
  const req = await api.post("/bases/rows/list", { baseId, ...params });
  return req.data;
}

export async function reorderRow(data: ReorderRowInput): Promise<void> {
  await api.post("/bases/rows/reorder", data);
}

// --- Views ---

export async function createView(data: CreateViewInput): Promise<IBaseView> {
  const req = await api.post<IBaseView>("/bases/views/create", data);
  return req.data;
}

export async function updateView(data: UpdateViewInput): Promise<IBaseView> {
  const req = await api.post<IBaseView>("/bases/views/update", data);
  return req.data;
}

export async function deleteView(data: DeleteViewInput): Promise<void> {
  await api.post("/bases/views/delete", data);
}

export async function listViews(baseId: string): Promise<IBaseView[]> {
  const req = await api.post<IBaseView[]>("/bases/views/list", { baseId });
  return req.data;
}
