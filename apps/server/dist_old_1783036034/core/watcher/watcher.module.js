"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatcherModule = void 0;
const common_1 = require("@nestjs/common");
const watcher_service_1 = require("./watcher.service");
const watcher_controller_1 = require("./watcher.controller");
const space_watcher_controller_1 = require("./space-watcher.controller");
const page_access_module_1 = require("../page/page-access/page-access.module");
let WatcherModule = class WatcherModule {
};
exports.WatcherModule = WatcherModule;
exports.WatcherModule = WatcherModule = __decorate([
    (0, common_1.Module)({
        imports: [page_access_module_1.PageAccessModule],
        controllers: [watcher_controller_1.WatcherController, space_watcher_controller_1.SpaceWatcherController],
        providers: [watcher_service_1.WatcherService],
        exports: [watcher_service_1.WatcherService],
    })
], WatcherModule);
//# sourceMappingURL=watcher.module.js.map