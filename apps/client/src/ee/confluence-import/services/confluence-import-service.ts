import api from "@/lib/api-client";
import {
  ConfluenceCredentials,
  ConfluencePageHistoryMode,
  ImportStatusResponse,
  ListImportsResponse,
  StartImportResponse,
  TestConnectionResponse,
} from "@/ee/confluence-import/types/confluence-import.types";

export async function testConfluenceConnection(
  data: ConfluenceCredentials,
  signal?: AbortSignal,
): Promise<TestConnectionResponse> {
  const req = await api.post<TestConnectionResponse>(
    "/confluence-import/test-connection",
    data,
    { params: { includeSpaces: true }, timeout: 30_000, signal },
  );
  return req.data;
}

export async function startConfluenceImport(
  data: ConfluenceCredentials & {
    spaceKeys?: string[];
    fullEnumeration?: boolean;
    pageHistoryMode?: ConfluencePageHistoryMode;
    includeBlueprints?: boolean;
    includeBlogPosts?: boolean;
  },
): Promise<StartImportResponse> {
  const req = await api.post<StartImportResponse>(
    "/confluence-import/start",
    data,
  );
  return req.data;
}

export async function getConfluenceImportStatus(
  fileTaskId: string,
): Promise<ImportStatusResponse> {
  const req = await api.post<ImportStatusResponse>(
    "/confluence-import/status",
    { fileTaskId },
  );
  return req.data;
}

export async function listConfluenceImports(): Promise<ListImportsResponse> {
  const req = await api.post<ListImportsResponse>("/confluence-import/history");
  return req.data;
}

export async function cancelConfluenceImport(
  fileTaskId: string,
): Promise<{ success: boolean }> {
  const req = await api.post<{ success: boolean }>(
    "/confluence-import/cancel",
    { fileTaskId },
  );
  return req.data;
}
