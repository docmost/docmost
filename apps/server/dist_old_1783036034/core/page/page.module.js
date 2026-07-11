"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageModule = void 0;
const common_1 = require("@nestjs/common");
const page_service_1 = require("./services/page.service");
const page_controller_1 = require("./page.controller");
const page_history_service_1 = require("./services/page-history.service");
const trash_cleanup_service_1 = require("./services/trash-cleanup.service");
const backlink_service_1 = require("./services/backlink.service");
const storage_module_1 = require("../../integrations/storage/storage.module");
const collaboration_module_1 = require("../../collaboration/collaboration.module");
const watcher_module_1 = require("../watcher/watcher.module");
const transclusion_module_1 = require("./transclusion/transclusion.module");
const label_module_1 = require("../label/label.module");
let PageModule = class PageModule {
};
exports.PageModule = PageModule;
exports.PageModule = PageModule = __decorate([
    (0, common_1.Module)({
        controllers: [page_controller_1.PageController],
        providers: [
            page_service_1.PageService,
            page_history_service_1.PageHistoryService,
            trash_cleanup_service_1.TrashCleanupService,
            backlink_service_1.BacklinkService,
        ],
        exports: [page_service_1.PageService, page_history_service_1.PageHistoryService],
        imports: [
            storage_module_1.StorageModule,
            collaboration_module_1.CollaborationModule,
            watcher_module_1.WatcherModule,
            transclusion_module_1.TransclusionModule,
            label_module_1.LabelModule,
        ],
    })
], PageModule);
//# sourceMappingURL=page.module.js.map