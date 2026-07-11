import { TransclusionNodeSnapshot } from '../transclusion.types';
export type TransclusionReferenceSnapshot = {
    sourcePageId: string;
    transclusionId: string;
};
export declare function collectTransclusionsFromPmJson(doc: unknown): TransclusionNodeSnapshot[];
export declare function collectReferencesFromPmJson(doc: unknown): TransclusionReferenceSnapshot[];
