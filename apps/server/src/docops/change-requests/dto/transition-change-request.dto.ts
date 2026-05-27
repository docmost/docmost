import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
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
}
