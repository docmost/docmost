import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export const CR_ACTIONS = [
  'submit',
  'take_for_review',
  'approve',
  'reject',
  'assign_to_self',
  'submit_for_verification',
  'reject_implementation',
  'publish',
  'close',
  'cancel',
] as const;

export class TransitionChangeRequestDto {
  @IsUUID()
  id: string;

  @IsIn(CR_ACTIONS)
  action: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  rowVersion?: number;
}
