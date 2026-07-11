"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StorageModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageModule = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("./storage.service");
const storage_provider_1 = require("./providers/storage.provider");
let StorageModule = StorageModule_1 = class StorageModule {
    static forRootAsync(options) {
        return {
            module: StorageModule_1,
            imports: options.imports || [],
            providers: [
                storage_provider_1.storageDriverConfigProvider,
                storage_provider_1.storageDriverProvider,
                storage_service_1.StorageService,
            ],
            exports: [storage_service_1.StorageService],
        };
    }
};
exports.StorageModule = StorageModule;
exports.StorageModule = StorageModule = StorageModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], StorageModule);
//# sourceMappingURL=storage.module.js.map