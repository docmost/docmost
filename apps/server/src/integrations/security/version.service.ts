import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./../../../package.json');

@Injectable()
export class VersionService {
  constructor(private readonly environmentService: EnvironmentService) {}

  async getVersion() {
    const currentVersion =
      this.environmentService.getAppReleaseVersion() || packageJson?.version;

    return {
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: null,
    };
  }
}
