import { EnvironmentService } from '../../environment/environment.service';
import { StorageConfig, StorageDriver, StorageOption } from '../interfaces';
export declare const storageDriverConfigProvider: {
    provide: string;
    useFactory: (environmentService: EnvironmentService) => Promise<{
        driver: StorageOption.S3;
        config: {
            region: string;
            endpoint: string;
            bucket: string;
            baseUrl: string;
            forcePathStyle: boolean;
            credentials: any;
        };
    } | {
        driver: StorageOption.LOCAL;
        config: {
            storagePath: string;
            accountName?: undefined;
            container?: undefined;
            accountKey?: undefined;
            endpoint?: undefined;
            baseUrl?: undefined;
        };
    } | {
        driver: StorageOption.AZURE;
        config: {
            accountName: string;
            container: string;
            accountKey: string;
            endpoint: string;
            baseUrl: string;
            storagePath?: undefined;
        };
    }>;
    inject: (typeof EnvironmentService)[];
};
export declare const storageDriverProvider: {
    provide: string;
    useFactory: (config: StorageConfig) => StorageDriver;
    inject: string[];
};
