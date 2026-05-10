export type TransclusionLookup =
  | {
      sourcePageId: string;
      transclusionId: string;
      content: unknown;
      sourceUpdatedAt: Date;
    }
  | { sourcePageId: string; transclusionId: string; status: 'not_found' }
  | { sourcePageId: string; transclusionId: string; status: 'no_access' };

export type TransclusionNodeSnapshot = {
  transclusionId: string;
  content: unknown;
};
