import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CR_ACTIONS, CloseReason } from '../state-machine/cr-state.types';

export class TransitionChangeRequestDto {
  @IsUUID()
  id: string;

  @IsIn([...CR_ACTIONS])
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['REJECTED', 'CANCELLED'])
  closeReason?: CloseReason;

  @IsOptional()
  @IsNumber()
  rowVersion?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'docVersion must be a valid SemVer (e.g. 1.2.3)' })
  docVersion?: string;
}
