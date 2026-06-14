import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly environmentService: EnvironmentService,
  ) {
    // Telemetry is disabled in this fork
  }
}
