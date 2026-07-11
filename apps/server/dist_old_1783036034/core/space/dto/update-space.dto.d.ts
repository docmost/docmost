import { CreateSpaceDto } from './create-space.dto';
declare const UpdateSpaceDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateSpaceDto>>;
export declare class UpdateSpaceDto extends UpdateSpaceDto_base {
    spaceId: string;
    disablePublicSharing: boolean;
    allowViewerComments: boolean;
}
export {};
