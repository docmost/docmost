"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureDriver = void 0;
const stream_1 = require("stream");
const interfaces_1 = require("../interfaces");
const storage_blob_1 = require("@azure/storage-blob");
const common_1 = require("@nestjs/common");
const helpers_1 = require("../../../common/helpers");
class AzureDriver {
    constructor(config) {
        this.config = config;
        if (!config.accountName) {
            throw new Error('AzureDriver: accountName is required');
        }
        if (!config.container) {
            throw new Error('AzureDriver: container is required');
        }
        if (!config.accountKey) {
            throw new Error('AzureDriver: accountKey is required');
        }
        this.accountUrl =
            config.endpoint ??
                `https://${config.accountName}.blob.core.windows.net`;
        this.sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(config.accountName, config.accountKey);
        this.blobServiceClient = this.createBlobServiceClient();
        this.containerClient = this.blobServiceClient.getContainerClient(config.container);
    }
    blockBlob(filePath) {
        return this.containerClient.getBlockBlobClient(filePath);
    }
    async upload(filePath, file) {
        const stream = Buffer.isBuffer(file) ? stream_1.Readable.from(file) : file;
        await this.uploadStream(filePath, stream);
    }
    async uploadStream(filePath, file, options) {
        const clientToUse = options?.recreateClient
            ? this.createBlobServiceClient()
                .getContainerClient(this.config.container)
                .getBlockBlobClient(filePath)
            : this.blockBlob(filePath);
        try {
            const contentType = (0, helpers_1.getMimeType)(filePath);
            await clientToUse.uploadStream(file, undefined, undefined, {
                blobHTTPHeaders: { blobContentType: contentType },
            });
        }
        catch (err) {
            common_1.Logger.error(err);
            throw new Error(`Failed to upload file: ${err.message}`);
        }
    }
    async copy(fromFilePath, toFilePath) {
        try {
            if (!(await this.exists(fromFilePath))) {
                return;
            }
            const sourceUrl = await this.getSignedUrl(fromFilePath, 60);
            const dest = this.blockBlob(toFilePath);
            await dest.syncCopyFromURL(sourceUrl);
        }
        catch (err) {
            throw new Error(`Failed to copy file: ${err.message}`);
        }
    }
    async read(filePath) {
        try {
            return await this.blockBlob(filePath).downloadToBuffer();
        }
        catch (err) {
            throw new Error(`Failed to read file from Azure: ${err.message}`);
        }
    }
    async readStream(filePath) {
        try {
            const response = await this.blockBlob(filePath).download();
            return response.readableStreamBody;
        }
        catch (err) {
            throw new Error(`Failed to read file from Azure: ${err.message}`);
        }
    }
    async readRangeStream(filePath, range) {
        try {
            const count = range.end - range.start + 1;
            const response = await this.blockBlob(filePath).download(range.start, count);
            return response.readableStreamBody;
        }
        catch (err) {
            throw new Error(`Failed to read file from Azure: ${err.message}`);
        }
    }
    async exists(filePath) {
        try {
            return await this.blockBlob(filePath).exists();
        }
        catch (err) {
            throw new Error(`Failed to check existence in Azure: ${err.message}`);
        }
    }
    getUrl(filePath) {
        const base = this.config.baseUrl ?? this.accountUrl;
        return `${base}/${this.config.container}/${filePath}`;
    }
    async getSignedUrl(filePath, expiresIn) {
        const expiresOn = new Date(Date.now() + expiresIn * 1000);
        const sas = (0, storage_blob_1.generateBlobSASQueryParameters)({
            containerName: this.config.container,
            blobName: filePath,
            permissions: storage_blob_1.BlobSASPermissions.parse('r'),
            expiresOn,
            protocol: storage_blob_1.SASProtocol.HttpsAndHttp,
        }, this.sharedKeyCredential).toString();
        return `${this.accountUrl}/${this.config.container}/${filePath}?${sas}`;
    }
    async delete(filePath) {
        try {
            await this.blockBlob(filePath).delete();
        }
        catch (err) {
            throw new Error(`Error deleting file ${filePath} from Azure: ${err.message}`);
        }
    }
    getDriver() {
        return this.blobServiceClient;
    }
    getDriverName() {
        return interfaces_1.StorageOption.AZURE;
    }
    getConfig() {
        return this.config;
    }
    createBlobServiceClient() {
        return new storage_blob_1.BlobServiceClient(this.accountUrl, this.sharedKeyCredential);
    }
}
exports.AzureDriver = AzureDriver;
//# sourceMappingURL=azure.driver.js.map