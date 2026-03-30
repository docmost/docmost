import { PartialType } from '@nestjs/mapped-types';
import { CreateOidcProviderDto } from './create-oidc-provider.dto';

export class UpdateOidcProviderDto extends PartialType(CreateOidcProviderDto) {}
