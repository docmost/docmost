export enum FileTaskType {
  Import = 'import',
  Export = 'export',
}

export enum FileImportType {
  Generic = 'generic',
  Notion = 'notion',
  Confluence = 'confluence',
}

export enum FileTaskStatus {
  Pending = 'pending',
  Processing = 'processing',
  Success = 'success',
  Failed = 'failed',
}

export function getFileTaskFolderPath(
  type: FileTaskType,
  workspaceId: string,
): string {
  switch (type) {
    case FileTaskType.Import:
      return `${workspaceId}/imports`;
    case FileTaskType.Export:
      return `${workspaceId}/exports`;
  }
}
