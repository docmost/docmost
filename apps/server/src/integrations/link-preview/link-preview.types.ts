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

export type IframelyLink = { href?: string; rel?: string[] | string; type?: string };

export type IframelyResponse = {
  url?: string;
  code?: string;
  error?: unknown;
  meta?: { title?: string; description?: string; canonical?: string };
  links?: Record<string, IframelyLink | IframelyLink[]> | IframelyLink[];
};

export type IframelyResult = { preview: LinkPreview; reportedUrl?: string };
