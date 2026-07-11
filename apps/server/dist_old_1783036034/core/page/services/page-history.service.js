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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageHistoryService = void 0;
const common_1 = require("@nestjs/common");
const page_history_repo_1 = require("../../../database/repos/page/page-history.repo");
let PageHistoryService = class PageHistoryService {
    constructor(pageHistoryRepo) {
        this.pageHistoryRepo = pageHistoryRepo;
    }
    async findById(historyId) {
        return await this.pageHistoryRepo.findById(historyId, {
            includeContent: true,
        });
    }
    async findHistoryByPageId(pageId, paginationOptions) {
        return this.pageHistoryRepo.findPageHistoryByPageId(pageId, paginationOptions);
    }
};
exports.PageHistoryService = PageHistoryService;
exports.PageHistoryService = PageHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [page_history_repo_1.PageHistoryRepo])
], PageHistoryService);
//# sourceMappingURL=page-history.service.js.map