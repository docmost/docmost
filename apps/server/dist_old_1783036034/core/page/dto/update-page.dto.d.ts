import { CreatePageDto, ContentFormat } from './create-page.dto';
import type { PageMetadata } from './page-metadata.dto';
export type ContentOperation = 'append' | 'prepend' | 'replace';
declare const UpdatePageDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreatePageDto>>;
export declare class UpdatePageDto extends UpdatePageDto_base {
    pageId: string;
    content?: string | object;
    operation?: ContentOperation;
    format?: ContentFormat;
    metadata?: PageMetadata;
}
export {};
