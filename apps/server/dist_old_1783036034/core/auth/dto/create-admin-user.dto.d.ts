import { CreateUserDto } from './create-user.dto';
export declare class CreateAdminUserDto extends CreateUserDto {
    name: string;
    workspaceName: string;
    hostname?: string;
}
