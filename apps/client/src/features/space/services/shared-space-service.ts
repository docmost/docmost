import api from "@/lib/api-client";
import { IExportSpaceParams, ISpace } from "@/features/space/types/space.types";
import { saveAs } from "file-saver";

export async function getSharedSpaceById(spaceId: string): Promise<ISpace> {
  const req = await api.post<ISpace>("/share/spaces/info", { spaceId });
  return req.data;
}

export async function exportSharedSpace(data: IExportSpaceParams): Promise<void> {
  const req = await api.post("/share/spaces/export", data, {
    responseType: "blob",
  });

  const fileName = req?.headers["content-disposition"]
    .split("filename=")[1]
    .replace(/"/g, "");

  saveAs(req.data, decodeURIComponent(fileName));
}
