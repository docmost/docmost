"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentModule = void 0;
const common_1 = require("@nestjs/common");
const attachment_service_1 = require("./services/attachment.service");
const attachment_controller_1 = require("./attachment.controller");
const storage_module_1 = require("../../integrations/storage/storage.module");
const user_module_1 = require("../user/user.module");
const workspace_module_1 = require("../workspace/workspace.module");
const attachment_processor_1 = require("./processors/attachment.processor");
const token_module_1 = require("../auth/token.module");
let AttachmentModule = class AttachmentModule {
};
exports.AttachmentModule = AttachmentModule;
exports.AttachmentModule = AttachmentModule = __decorate([
    (0, common_1.Module)({
        imports: [storage_module_1.StorageModule, user_module_1.UserModule, workspace_module_1.WorkspaceModule, token_module_1.TokenModule],
        controllers: [attachment_controller_1.AttachmentController],
        providers: [attachment_service_1.AttachmentService, attachment_processor_1.AttachmentProcessor],
    })
], AttachmentModule);
//# sourceMappingURL=attachment.module.js.map