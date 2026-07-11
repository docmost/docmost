"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDriver = void 0;
const interfaces_1 = require("../interfaces");
const path_1 = require("path");
const fs = require("fs-extra");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:stream/promises");
class LocalDriver {
    constructor(config) {
        this.config = config;
    }
    _fullPath(filePath) {
        const storageRoot = (0, path_1.resolve)(this.config.storagePath);
        const fullPath = (0, path_1.resolve)(storageRoot, filePath);
        if (fullPath !== storageRoot && !fullPath.startsWith(storageRoot + path_1.sep)) {
            throw new Error('Invalid file path');
        }
        return fullPath;
    }
    async upload(filePath, file) {
        try {
            const fullPath = this._fullPath(filePath);
            if (file instanceof Buffer) {
                await fs.outputFile(fullPath, file);
            }
            else {
                await fs.mkdir((0, path_1.dirname)(fullPath), { recursive: true });
                await (0, promises_1.pipeline)(file, (0, node_fs_1.createWriteStream)(fullPath));
            }
        }
        catch (err) {
            throw new Error(`Failed to upload file: ${err.message}`);
        }
    }
    async uploadStream(filePath, file, options) {
        try {
            const fullPath = this._fullPath(filePath);
            await fs.mkdir((0, path_1.dirname)(fullPath), { recursive: true });
            await (0, promises_1.pipeline)(file, (0, node_fs_1.createWriteStream)(fullPath));
        }
        catch (err) {
            throw new Error(`Failed to upload file: ${err.message}`);
        }
    }
    async copy(fromFilePath, toFilePath) {
        try {
            const fromFullPath = this._fullPath(fromFilePath);
            const toFullPath = this._fullPath(toFilePath);
            if (await this.exists(fromFilePath)) {
                await fs.copy(fromFullPath, toFullPath);
            }
        }
        catch (err) {
            throw new Error(`Failed to copy file: ${err.message}`);
        }
    }
    async read(filePath) {
        try {
            return await fs.readFile(this._fullPath(filePath));
        }
        catch (err) {
            throw new Error(`Failed to read file: ${err.message}`);
        }
    }
    async readStream(filePath) {
        const fullPath = this._fullPath(filePath);
        if (!(await fs.pathExists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }
        return (0, node_fs_1.createReadStream)(fullPath);
    }
    async readRangeStream(filePath, range) {
        const fullPath = this._fullPath(filePath);
        if (!(await fs.pathExists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }
        return (0, node_fs_1.createReadStream)(fullPath, {
            start: range.start,
            end: range.end,
        });
    }
    async exists(filePath) {
        try {
            return await fs.pathExists(this._fullPath(filePath));
        }
        catch (err) {
            throw new Error(`Failed to check file existence: ${err.message}`);
        }
    }
    async getSignedUrl(filePath, expireIn) {
        throw new Error('Signed URLs are not supported for local storage.');
    }
    getUrl(filePath) {
        return this._fullPath(filePath);
    }
    async delete(filePath) {
        try {
            await fs.remove(this._fullPath(filePath));
        }
        catch (err) {
            throw new Error(`Failed to delete file: ${err.message}`);
        }
    }
    getDriver() {
        return fs;
    }
    getDriverName() {
        return interfaces_1.StorageOption.LOCAL;
    }
    getConfig() {
        return this.config;
    }
}
exports.LocalDriver = LocalDriver;
//# sourceMappingURL=local.driver.js.map