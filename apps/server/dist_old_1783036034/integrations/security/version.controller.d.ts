import { VersionService } from './version.service';
import { EnvironmentService } from '../environment/environment.service';
export declare class VersionController {
    private readonly versionService;
    private readonly environmentService;
    constructor(versionService: VersionService, environmentService: EnvironmentService);
    getVersion(): Promise<{
        currentVersion: any;
        latestVersion: number;
        releaseUrl: string;
    }>;
}
