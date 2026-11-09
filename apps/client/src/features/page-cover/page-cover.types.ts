export type CoverPresetKind = "color" | "gradient" | "texture";

export type CoverPreset = {
  id: string;
  kind: CoverPresetKind;
  label: string;
  color?: string;
  src?: string;
  thumb?: string;
};

export type ResolvedCover =
  | { kind: "color"; color: string }
  | { kind: "image"; src: string };

export type PageCoverUpdate = {
  coverPhoto?: string | null;
  coverPosition?: number | null;
};

export type CoverAttribution = {
  source: "unsplash";
  photoId: string;
  authorName: string;
  authorUsername: string;
};

export type PageCoverFields = PageCoverUpdate & {
  coverAttribution?: CoverAttribution | null;
};

export type CoverChange = PageCoverUpdate & {
  preview?: PageCoverFields;
};

export type UnsplashPhoto = {
  id: string;
  description: string | null;
  color: string | null;
  thumbUrl: string;
  coverUrl: string;
  authorName: string;
  authorUsername: string;
};

export type UnsplashPhotoList = {
  items: UnsplashPhoto[];
  hasMore: boolean;
};

export type CoverFocusRequest = {
  pageId: string;
  target: "change-cover" | "add-cover";
  requestedAt: number;
};
