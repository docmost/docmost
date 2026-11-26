export type LinkPreview = {
  title: string;
  description?: string;
  image?: string;
  icon?: string;
};

export type LinkPreviewHop = {
  response: Response;
  release: () => Promise<void>;
};
