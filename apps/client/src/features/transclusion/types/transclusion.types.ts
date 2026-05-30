export type TransclusionLookup =
  | {
      sourcePageId: string;
      transclusionId: string;
      content: unknown;
      sourceUpdatedAt: string;
    }
  | { sourcePageId: string; transclusionId: string; status: "not_found" }
  | { sourcePageId: string; transclusionId: string; status: "no_access" };

export type ReferencingPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  spaceSlug: string | null;
};

export type ReferencingPagesResponse = {
  source: ReferencingPage | null;
  references: ReferencingPage[];
};
