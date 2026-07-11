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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelService = void 0;
const common_1 = require("@nestjs/common");
const label_repo_1 = require("../../database/repos/label/label.repo");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../database/utils");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const utils_2 = require("./utils");
let LabelService = class LabelService {
    constructor(labelRepo, pagePermissionRepo, db) {
        this.labelRepo = labelRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.db = db;
    }
    async addLabelsToPage(pageId, names, workspaceId) {
        const attached = [];
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            for (const name of names) {
                const label = await this.labelRepo.findOrCreate(name.trim(), workspaceId, label_repo_1.LabelType.PAGE, trx);
                await this.labelRepo.addLabelToPage(pageId, label.id, trx);
                attached.push(label);
            }
        });
        return attached;
    }
    async removeLabelFromPage(pageId, labelId, workspaceId) {
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            const label = await this.labelRepo.findById(labelId, trx);
            if (!label || label.workspaceId !== workspaceId) {
                throw new common_1.NotFoundException('Label not found');
            }
            await this.labelRepo.removeLabelFromPage(pageId, labelId, workspaceId, trx);
            const count = await this.labelRepo.getLabelPageCount(labelId, workspaceId, trx);
            if (count === 0) {
                await this.labelRepo.deleteLabel(labelId, workspaceId, trx);
            }
        });
    }
    async getPageLabels(pageId, pagination) {
        return this.labelRepo.findLabelsByPageId(pageId, pagination);
    }
    async getLabels(workspaceId, userId, type, pagination) {
        return this.labelRepo.findLabels(workspaceId, userId, type, pagination);
    }
    async findPagesByLabel(labelId, userId, opts) {
        const result = await this.labelRepo.findPagesByLabelId(labelId, userId, opts);
        if (result.items.length === 0)
            return result;
        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds: result.items.map((p) => p.id),
            userId,
            spaceId: opts.spaceId,
        });
        const accessible = new Set(accessibleIds);
        return {
            items: result.items.filter((p) => accessible.has(p.id)),
            meta: result.meta,
        };
    }
    async getLabelInfo(name, type, workspaceId, userId, spaceId) {
        const normalized = (0, utils_2.normalizeLabelName)(name);
        const label = await this.labelRepo.findByNameAndWorkspace(normalized, workspaceId, type);
        const usageCount = label
            ? await this.labelRepo.getLabelPageCountForUser(label.id, userId, spaceId)
            : 0;
        return {
            name: normalized,
            usageCount,
        };
    }
};
exports.LabelService = LabelService;
exports.LabelService = LabelService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [label_repo_1.LabelRepo,
        page_permission_repo_1.PagePermissionRepo, Object])
], LabelService);
//# sourceMappingURL=label.service.js.map