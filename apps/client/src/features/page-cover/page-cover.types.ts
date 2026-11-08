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
