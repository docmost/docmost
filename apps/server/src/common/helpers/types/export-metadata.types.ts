export type ExportPageMetadata = {
  pageId: string;
  slugId: string;
  icon: string | null;
  position: string;
  parentPath: string | null;
};

export type ExportMetadata = {
  version: number;
  exportedAt: string;
  source: 'docmost';
  pages: Record<string, ExportPageMetadata>;
};
