"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageDriverProvider = exports.storageDriverConfigProvider = void 0;
const storage_constants_1 = require("../constants/storage.constants");
const environment_service_1 = require("../../environment/environment.service");
const interfaces_1 = require("../interfaces");
const drivers_1 = require("../drivers");
const helpers_1 = require("../../../common/helpers");
function createStorageDriver(disk) {
    switch (disk.driver) {
        case interfaces_1.StorageOption.LOCAL:
            return new drivers_1.LocalDriver(disk.config);
        case interfaces_1.StorageOption.S3:
            return new drivers_1.S3Driver(disk.config);
        case interfaces_1.StorageOption.AZURE:
            return new drivers_1.AzureDriver(disk.config);
        default:
            throw new Error(`Unknown storage driver`);
    }
}
exports.storageDriverConfigProvider = {
    provide: storage_constants_1.STORAGE_CONFIG_TOKEN,
    useFactory: async (environmentService) => {
        const driver = environmentService.getStorageDriver().toLowerCase();
        switch (driver) {
            case interfaces_1.StorageOption.LOCAL:
                return {
                    driver,
                    config: {
                        storagePath: helpers_1.LOCAL_STORAGE_PATH,
                    },
                };
            case interfaces_1.StorageOption.S3:
                {
                    const s3Config = {
                        driver,
                        config: {
                            region: environmentService.getAwsS3Region(),
                            endpoint: environmentService.getAwsS3Endpoint(),
                            bucket: environmentService.getAwsS3Bucket(),
                            baseUrl: environmentService.getAwsS3Url(),
                            forcePathStyle: environmentService.getAwsS3ForcePathStyle(),
                            credentials: undefined,
                        },
                    };
                    if (environmentService.getAwsS3AccessKeyId() ||
                        environmentService.getAwsS3SecretAccessKey()) {
                        s3Config.config.credentials = {
                            accessKeyId: environmentService.getAwsS3AccessKeyId(),
                            secretAccessKey: environmentService.getAwsS3SecretAccessKey(),
                        };
                    }
                    return s3Config;
                }
            case interfaces_1.StorageOption.AZURE:
                return {
                    driver,
                    config: {
                        accountName: environmentService.getAzureStorageAccountName(),
                        container: environmentService.getAzureStorageContainer(),
                        accountKey: environmentService.getAzureStorageAccountKey(),
                        endpoint: environmentService.getAzureStorageEndpoint() || undefined,
                        baseUrl: environmentService.getAzureStorageUrl() || undefined,
                    },
                };
            default:
                throw new Error(`Unknown storage driver: ${driver}`);
        }
    },
    inject: [environment_service_1.EnvironmentService],
};
exports.storageDriverProvider = {
    provide: storage_constants_1.STORAGE_DRIVER_TOKEN,
    useFactory: (config) => createStorageDriver(config),
    inject: [storage_constants_1.STORAGE_CONFIG_TOKEN],
};
//# sourceMappingURL=storage.provider.js.map