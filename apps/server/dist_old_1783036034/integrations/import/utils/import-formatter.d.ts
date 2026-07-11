import { InsertableBacklink } from "../../../database/types/entity.types";
import { Cheerio, CheerioAPI } from 'cheerio';
export declare function formatImportHtml(opts: {
    html: string;
    currentFilePath: string;
    filePathToPageMetaMap: Map<string, {
        id: string;
        title: string;
        slugId: string;
    }>;
    creatorId: string;
    sourcePageId: string;
    workspaceId: string;
    pageDir?: string;
    attachmentCandidates?: string[];
    spaceSlug?: string;
}): Promise<{
    html: string;
    backlinks: InsertableBacklink[];
    pageIcon?: string;
}>;
export declare function normalizeImportHtml($: CheerioAPI, $root: Cheerio<any>): void;
export declare function xwikiFormatter($: CheerioAPI, $root: Cheerio<any>): void;
export declare function defaultHtmlFormatter($: CheerioAPI, $root: Cheerio<any>): void;
export declare function notionFormatter($: CheerioAPI, $root: Cheerio<any>): void;
export declare function unwrapFromParagraph($: CheerioAPI, $node: Cheerio<any>): void;
export declare function rewriteInternalLinksToMentionHtml($: CheerioAPI, $root: Cheerio<any>, currentFilePath: string, filePathToPageMetaMap: Map<string, {
    id: string;
    title: string;
    slugId: string;
}>, creatorId: string, sourcePageId: string, workspaceId: string, spaceSlug?: string): Promise<InsertableBacklink[]>;
