export interface IEmbedProvider {
    id: string;
    name: string;
    regex: RegExp;
    getEmbedUrl: (match: RegExpMatchArray, url?: string) => string;
}
export declare const embedProviders: IEmbedProvider[];
export declare function getEmbedProviderById(id: string): IEmbedProvider;
export interface IEmbedResult {
    embedUrl: string;
    provider: string;
}
export declare function getEmbedUrlAndProvider(url: string): IEmbedResult;
