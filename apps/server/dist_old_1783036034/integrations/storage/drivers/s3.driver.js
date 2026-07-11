"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Driver = void 0;
const interfaces_1 = require("../interfaces");
const client_s3_1 = require("@aws-sdk/client-s3");
const storage_utils_1 = require("../storage.utils");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const helpers_1 = require("../../../common/helpers");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const common_1 = require("@nestjs/common");
class S3Driver {
    constructor(config) {
        this.config = config;
        this.s3Client = new client_s3_1.S3Client(config);
    }
    async upload(filePath, file) {
        try {
            const contentType = (0, helpers_1.getMimeType)(filePath);
            const upload = new lib_storage_1.Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.config.bucket,
                    Key: filePath,
                    Body: file,
                    ContentType: contentType,
                },
            });
            await upload.done();
        }
        catch (err) {
            common_1.Logger.error(err);
            throw new Error(`Failed to upload file: ${err.message}`);
        }
    }
    async uploadStream(filePath, file, options) {
        let clientToUse = this.s3Client;
        let shouldDestroyClient = false;
        if (options?.recreateClient) {
            clientToUse = new client_s3_1.S3Client(this.config);
            shouldDestroyClient = true;
        }
        try {
            const contentType = (0, helpers_1.getMimeType)(filePath);
            const upload = new lib_storage_1.Upload({
                client: clientToUse,
                params: {
                    Bucket: this.config.bucket,
                    Key: filePath,
                    Body: file,
                    ContentType: contentType,
                },
            });
            await upload.done();
        }
        catch (err) {
            common_1.Logger.error(err);
            throw new Error(`Failed to upload file: ${err.message}`);
        }
        finally {
            if (shouldDestroyClient && clientToUse) {
                clientToUse.destroy();
            }
        }
    }
    async copy(fromFilePath, toFilePath) {
        try {
            if (await this.exists(fromFilePath)) {
                await this.s3Client.send(new client_s3_1.CopyObjectCommand({
                    Bucket: this.config.bucket,
                    CopySource: `${this.config.bucket}/${fromFilePath}`,
                    Key: toFilePath,
                }));
            }
        }
        catch (err) {
            throw new Error(`Failed to copy file: ${err.message}`);
        }
    }
    async read(filePath) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.config.bucket,
                Key: filePath,
            });
            const response = await this.s3Client.send(command);
            return (0, storage_utils_1.streamToBuffer)(response.Body);
        }
        catch (err) {
            throw new Error(`Failed to read file from S3: ${err.message}`);
        }
    }
    async readStream(filePath) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.config.bucket,
                Key: filePath,
            });
            const response = await this.s3Client.send(command);
            return response.Body;
        }
        catch (err) {
            throw new Error(`Failed to read file from S3: ${err.message}`);
        }
    }
    async readRangeStream(filePath, range) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.config.bucket,
                Key: filePath,
                Range: `bytes=${range.start}-${range.end}`,
            });
            const response = await this.s3Client.send(command);
            return response.Body;
        }
        catch (err) {
            throw new Error(`Failed to read file from S3: ${err.message}`);
        }
    }
    async exists(filePath) {
        try {
            const command = new client_s3_1.HeadObjectCommand({
                Bucket: this.config.bucket,
                Key: filePath,
            });
            await this.s3Client.send(command);
            return true;
        }
        catch (err) {
            if (err instanceof client_s3_1.NoSuchKey) {
                return false;
            }
            throw err;
        }
    }
    getUrl(filePath) {
        return `${this.config.baseUrl ?? this.config.endpoint}/${this.config.bucket}/${filePath}`;
    }
    async getSignedUrl(filePath, expiresIn) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.config.bucket,
            Key: filePath,
        });
        return await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn });
    }
    async delete(filePath) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.config.bucket,
                Key: filePath,
            });
            await this.s3Client.send(command);
        }
        catch (err) {
            throw new Error(`Error deleting file ${filePath} from S3. ${err.message}`);
        }
    }
    getDriver() {
        return this.s3Client;
    }
    getDriverName() {
        return interfaces_1.StorageOption.S3;
    }
    getConfig() {
        return this.config;
    }
}
exports.S3Driver = S3Driver;
//# sourceMappingURL=s3.driver.js.map