import { IsIn, IsOptional } from 'class-validator';

export class DashboardPeriodDto {
  @IsOptional()
  @IsIn(['month', 'quarter', 'year'])
  period?: 'month' | 'quarter' | 'year';
}
