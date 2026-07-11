export declare class VersionService {
    constructor();
    getVersion(): Promise<{
        currentVersion: any;
        latestVersion: number;
        releaseUrl: string;
    }>;
}
