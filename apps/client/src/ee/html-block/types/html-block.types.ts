export interface IHtmlBlock {
  id: string;
  pageId: string | null;
  templateId: string | null;
  content: string;
  createdAt: string;
}

export interface IHtmlBlockSaved {
  id: string;
  pageId: string | null;
  templateId: string | null;
  size: number;
  createdAt: string;
}

export type PastedHtmlBlock = {
  pos: number;
  htmlBlockId: string;
};

export type HtmlBlockOwner = {
  pageId: string | null;
  templateId: string | null;
};

export type HtmlBlockScope = {
  shareId?: string;
  spaceSlug?: string;
  preloaded?: Record<string, string>;
};

export type HtmlBlockContentError = "disabled" | "unavailable";

export type HtmlBlockContentState = {
  content: string | undefined;
  isLoading: boolean;
  error: HtmlBlockContentError | null;
};

export type HtmlBlockAccess = {
  enabled: boolean;
  licensed: boolean;
  canEdit: boolean;
};

export type HtmlBlockFitState = "fitting" | "probing" | "frozen";

export type HtmlBlockFitController = {
  readonly state: HtmlBlockFitState;
  report(height: number, now: number): number | null;
  probeTimedOut(): void;
  reset(): void;
};

export type HtmlBlockFrameTheme = {
  colorScheme: "light" | "dark";
  fontFamily: string;
  textColor: string;
  fontSize: string;
};
