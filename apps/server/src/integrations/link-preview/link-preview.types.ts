export type LinkPreview = {
  title: string;
  description?: string;
  image?: string;
  icon?: string;
};

export type LinkPreviewPage = Partial<LinkPreview> & { oembedUrl?: string };

export type LinkPreviewHop = {
  response: Response;
  release: () => Promise<void>;
};

export type LinkPreviewRequest = {
  signal: AbortSignal;
  accept: string;
};
