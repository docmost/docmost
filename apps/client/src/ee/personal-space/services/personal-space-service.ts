import api from "@/lib/api-client";
import { ISpace } from "@/features/space/types/space.types";

export async function getPersonalSpace(): Promise<ISpace | null> {
  const req = await api.post<ISpace | null>("/personal-space/info", {});
  return req.data;
}

export async function createPersonalSpace(data: {
  name?: string;
}): Promise<ISpace> {
  const req = await api.post<ISpace>("/personal-space/create", data);
  return req.data;
}
