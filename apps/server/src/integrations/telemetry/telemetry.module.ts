import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  providers: [TelemetryService],
  imports: [ScheduleModule.forRoot()],
})
export class TelemetryModule {}
