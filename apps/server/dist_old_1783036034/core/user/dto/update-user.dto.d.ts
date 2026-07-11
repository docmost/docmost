import { CreateUserDto } from '../../auth/dto/create-user.dto';
declare const UpdateUserDto_base: import("@nestjs/mapped-types").MappedType<Partial<Omit<CreateUserDto, "password">>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
    fullPageWidth: boolean;
    pageEditMode: string;
    editorToolbar: boolean;
    locale: string;
    confirmPassword: string;
    notificationPageUpdates: boolean;
    notificationPageUserMention: boolean;
    notificationCommentUserMention: boolean;
    notificationCommentCreated: boolean;
    notificationCommentResolved: boolean;
}
export {};
