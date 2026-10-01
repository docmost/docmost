import api from "@/lib/api-client";
import {
  FormShareInfo,
  PublicFormResponse,
  SubmitFormPreviewInput,
  SubmitPublicFormInput,
  UpdateFormShareInput,
} from "@/ee/base/types/base.types";

export async function getFormShare(
  pageId: string,
  viewId: string,
): Promise<FormShareInfo> {
  const req = await api.post<FormShareInfo>("/bases/forms/share", {
    pageId,
    viewId,
  });
  return req.data;
}

export async function updateFormShare(
  data: UpdateFormShareInput,
): Promise<FormShareInfo> {
  const req = await api.post<FormShareInfo>("/bases/forms/share/update", data);
  return req.data;
}

export async function getPublicForm(key: string): Promise<PublicFormResponse> {
  const req = await api.post<PublicFormResponse>("/bases/forms/public/info", {
    key,
  });
  return req.data;
}

export async function submitPublicForm(
  data: SubmitPublicFormInput,
): Promise<void> {
  await api.post("/bases/forms/public/submit", data);
}

export async function submitFormPreview(
  data: SubmitFormPreviewInput,
): Promise<void> {
  await api.post("/bases/forms/submit", data);
}
