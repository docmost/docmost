"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportModule = void 0;
const common_1 = require("@nestjs/common");
const import_service_1 = require("./services/import.service");
const import_controller_1 = require("./import.controller");
const storage_module_1 = require("../storage/storage.module");
const file_import_task_service_1 = require("./services/file-import-task.service");
const file_task_processor_1 = require("./processors/file-task.processor");
const import_attachment_service_1 = require("./services/import-attachment.service");
const file_task_controller_1 = require("./file-task.controller");
const page_module_1 = require("../../core/page/page.module");
let ImportModule = class ImportModule {
};
exports.ImportModule = ImportModule;
exports.ImportModule = ImportModule = __decorate([
    (0, common_1.Module)({
        providers: [
            import_service_1.ImportService,
            file_import_task_service_1.FileImportTaskService,
            file_task_processor_1.FileTaskProcessor,
            import_attachment_service_1.ImportAttachmentService,
        ],
        exports: [import_service_1.ImportService, import_attachment_service_1.ImportAttachmentService],
        controllers: [import_controller_1.ImportController, file_task_controller_1.FileTaskController],
        imports: [storage_module_1.StorageModule, page_module_1.PageModule],
    })
], ImportModule);
//# sourceMappingURL=import.module.js.map