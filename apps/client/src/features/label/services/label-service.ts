import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import {
  IAddLabels,
  IFindPagesByLabelParams,
  ILabel,
  ILabelInfo,
  ILabelInfoParams,
  ILabelPageItem,
  IListLabelsParams,
  IPageLabelsParams,
  IRemoveLabel,
} from "@/features/label/types/label.types.ts";

export async function getPageLabels(
  params: IPageLabelsParams,
): Promise<IPagination<ILabel>> {
  const req = await api.post<IPagination<ILabel>>("/pages/labels", params);
  return req.data;
}

export async function getWorkspaceLabels(
  params: IListLabelsParams,
): Promise<IPagination<ILabel>> {
  const req = await api.post<IPagination<ILabel>>("/labels", params);
  return req.data;
}

export async function addLabelsToPage(
  data: IAddLabels,
): Promise<ILabel[]> {
  const req = await api.post<ILabel[]>("/pages/labels/add", data);
  return req.data;
}

export async function removeLabelFromPage(data: IRemoveLabel): Promise<void> {
  await api.post("/pages/labels/remove", data);
}

export async function getLabelInfo(
  params: ILabelInfoParams,
): Promise<ILabelInfo> {
  const req = await api.post<ILabelInfo>("/labels/info", params);
  return req.data;
}

export async function findPagesByLabel(
  params: IFindPagesByLabelParams,
): Promise<IPagination<ILabelPageItem>> {
  const req = await api.post<IPagination<ILabelPageItem>>(
    "/labels/pages",
    params,
  );
  return req.data;
}
