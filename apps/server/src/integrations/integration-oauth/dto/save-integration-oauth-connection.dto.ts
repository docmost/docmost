import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { SaveIntegrationOAuthConnectionInput } from '../integration-oauth-connection.service';

export class SaveIntegrationOAuthConnectionDto
  implements SaveIntegrationOAuthConnectionInput
{
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @IsString()
  @IsNotEmpty()
  oauthClientId: string;

  /** Omit to keep the stored secret; empty string clears it. */
  @IsOptional()
  @IsString()
  oauthClientSecret?: string;

  /** Validated per-field against the manifest's connectionSettings. */
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
