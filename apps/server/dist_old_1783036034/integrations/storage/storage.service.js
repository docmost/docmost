"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const storage_constants_1 = require("./constants/storage.constants");
let StorageService = StorageService_1 = class StorageService {
    constructor(storageDriver) {
        this.storageDriver = storageDriver;
        this.logger = new common_1.Logger(StorageService_1.name);
    }
    async upload(filePath, fileContent) {
        await this.storageDriver.upload(filePath, fileContent);
        this.logger.debug(`File uploaded successfully. Path: ${filePath}`);
    }
    async uploadStream(filePath, fileContent, options) {
        await this.storageDriver.uploadStream(filePath, fileContent, options);
        this.logger.debug(`File uploaded successfully. Path: ${filePath}`);
    }
    async copy(fromFilePath, toFilePath) {
        await this.storageDriver.copy(fromFilePath, toFilePath);
        this.logger.debug(`File copied successfully. Path: ${toFilePath}`);
    }
    async read(filePath) {
        return this.storageDriver.read(filePath);
    }
    async readStream(filePath) {
        return this.storageDriver.readStream(filePath);
    }
    async readRangeStream(filePath, range) {
        return this.storageDriver.readRangeStream(filePath, range);
    }
    async exists(filePath) {
        return this.storageDriver.exists(filePath);
    }
    async getSignedUrl(path, expireIn) {
        return this.storageDriver.getSignedUrl(path, expireIn);
    }
    getUrl(filePath) {
        return this.storageDriver.getUrl(filePath);
    }
    async delete(filePath) {
        await this.storageDriver.delete(filePath);
    }
    getDriverName() {
        return this.storageDriver.getDriverName();
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(storage_constants_1.STORAGE_DRIVER_TOKEN)),
    __metadata("design:paramtypes", [Object])
], StorageService);
//# sourceMappingURL=storage.service.js.map