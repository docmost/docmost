import { IsNotEmpty, IsString } from 'class-validator';
import { LookupDto } from '../../page/transclusion/dto/lookup.dto';

export class ShareTransclusionLookupDto extends LookupDto {
  @IsString()
  @IsNotEmpty()
  shareId!: string;
}
