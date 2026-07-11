export type SecurityHeader = {
    name: string;
    value: string;
};
export declare function resolveFrameHeader(iframeEmbedAllowed: boolean, allowedOrigins: string[]): SecurityHeader | null;
