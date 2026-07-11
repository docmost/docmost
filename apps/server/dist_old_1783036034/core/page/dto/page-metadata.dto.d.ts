export type MetadataType = 'text' | 'number' | 'boolean' | 'date';
export interface MetadataEntry {
    value: string;
    type: MetadataType;
}
export type PageMetadata = Record<string, MetadataEntry>;
export declare function validateMetadata(metadata: unknown): asserts metadata is PageMetadata;
