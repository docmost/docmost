import api from "@/lib/api-client";
import { saveAs } from "file-saver";
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
  DeleteRowsInput,
  ReorderRowInput,
  CreateViewInput,
  UpdateViewInput,
  DeleteViewInput,
  UpdatePropertyResult,
  FilterNode,
  ViewSortConfig,
  RowReferences,
} from "@/ee/base/types/base.types";
import { IPagination } from "@/lib/types";

export type IBaseRowsPage = IPagination<IBaseRow> & {
  references?: RowReferences;
};

export async function createBase(data: CreateBaseInput): Promise<IBase> {
  const req = await api.post<IBase>("/bases/create", data);
  return req.data;
}

export async function getBaseInfo(pageId: string): Promise<IBase> {
  const req = await api.post<IBase>("/bases/info", { pageId });
  return req.data;
}

export async function updateBase(data: UpdateBaseInput): Promise<IBase> {
  const req = await api.post<IBase>("/bases/update", data);
  return req.data;
}

export async function deleteBase(pageId: string): Promise<void> {
  await api.post("/bases/delete", { pageId });
}

export async function convertPageToBase(
  pageId: string,
  template?: "kanban",
): Promise<IBase> {
  const req = await api.post<IBase>("/bases/convert", { pageId, template });
  return req.data;
}

export async function exportBaseToCsv(pageId: string): Promise<void> {
  const req = await api.post(
    "/bases/export-csv",
    { pageId },
    { responseType: "blob" },
  );

  const header = (req?.headers?.["content-disposition"] as string) ?? "";
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  let fileName = utf8Match?.[1] ?? plainMatch?.[1] ?? "base.csv";
  try {
    fileName = decodeURIComponent(fileName);
  } catch {
    // fallback to raw filename
  }

  saveAs(req.data, fileName);
}

export async function listBases(
  spaceId: string,
  params?: { cursor?: string; limit?: number },
): Promise<IPagination<IBase>> {
  const req = await api.post("/bases", { spaceId, ...params });
  return req.data;
}

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

export async function createRow(data: CreateRowInput): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/create", data);
  return req.data;
}

export async function getRowInfo(
  rowId: string,
  pageId: string,
): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/info", { rowId, pageId });
  return req.data;
}

export async function updateRow(data: UpdateRowInput): Promise<IBaseRow> {
  const req = await api.post<IBaseRow>("/bases/rows/update", data);
  return req.data;
}

export async function deleteRow(data: DeleteRowInput): Promise<void> {
  await api.post("/bases/rows/delete", data);
}

export async function deleteRows(data: DeleteRowsInput): Promise<void> {
  await api.post("/bases/rows/delete-many", data);
}

export async function listRows(
  pageId: string,
  params?: {
    cursor?: string;
    limit?: number;
    filter?: FilterNode;
    sorts?: ViewSortConfig[];
  },
): Promise<IBaseRowsPage> {
  const req = await api.post("/bases/rows", { pageId, ...params });
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

export async function listViews(pageId: string): Promise<IBaseView[]> {
  const req = await api.post<IBaseView[]>("/bases/views", { pageId });
  return req.data;
}
