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
exports.ShareSeoController = void 0;
const common_1 = require("@nestjs/common");
const share_service_1 = require("./share.service");
const path_1 = require("path");
const fs = require("node:fs");
const uuid_1 = require("uuid");
const workspace_repo_1 = require("../../database/repos/workspace/workspace.repo");
const environment_service_1 = require("../../integrations/environment/environment.service");
const html_escaper_1 = require("../../common/helpers/html-escaper");
let ShareSeoController = class ShareSeoController {
    constructor(shareService, workspaceRepo, environmentService) {
        this.shareService = shareService;
        this.workspaceRepo = workspaceRepo;
        this.environmentService = environmentService;
    }
    async getShare(res, req, shareId, pageSlug) {
        let workspace = null;
        if (this.environmentService.isSelfHosted()) {
            workspace = await this.workspaceRepo.findFirst();
        }
        else {
            const header = req.raw.headers.host;
            const subdomain = header.split('.')[0];
            workspace = await this.workspaceRepo.findByHostname(subdomain);
        }
        const clientDistPath = (0, path_1.join)(__dirname, '..', '..', '..', '..', 'client/dist');
        if (fs.existsSync(clientDistPath)) {
            const indexFilePath = (0, path_1.join)(clientDistPath, 'index.html');
            if (!workspace) {
                return this.sendIndex(indexFilePath, res);
            }
            const pageId = this.extractPageSlugId(pageSlug);
            const share = await this.shareService.getShareForPage(pageId, workspace.id);
            if (!share) {
                return this.sendIndex(indexFilePath, res);
            }
            const rawTitle = (0, html_escaper_1.htmlEscape)(share?.sharedPage.title ?? 'untitled');
            const metaTitle = rawTitle.length > 80 ? `${rawTitle.slice(0, 77)}…` : rawTitle;
            const metaTagVar = '<!--meta-tags-->';
            const metaTags = [
                `<meta property="og:title" content="${metaTitle}" />`,
                `<meta property="twitter:title" content="${metaTitle}" />`,
                !share.searchIndexing ? `<meta name="robots" content="noindex" />` : '',
            ]
                .filter(Boolean)
                .join('\n    ');
            const html = fs.readFileSync(indexFilePath, 'utf8');
            const transformedHtml = html
                .replace(/<title>[\s\S]*?<\/title>/i, `<title>${metaTitle}</title>`)
                .replace(metaTagVar, metaTags);
            res.type('text/html').send(transformedHtml);
        }
    }
    sendIndex(indexFilePath, res) {
        const stream = fs.createReadStream(indexFilePath);
        res.type('text/html').send(stream);
    }
    extractPageSlugId(slug) {
        if (!slug) {
            return undefined;
        }
        if ((0, uuid_1.validate)(slug)) {
            return slug;
        }
        const parts = slug.split('-');
        return parts.length > 1 ? parts[parts.length - 1] : slug;
    }
};
exports.ShareSeoController = ShareSeoController;
__decorate([
    (0, common_1.Get)([':shareId/p/:pageSlug', 'p/:pageSlug']),
    __param(0, (0, common_1.Res)({ passthrough: false })),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Param)('shareId')),
    __param(3, (0, common_1.Param)('pageSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ShareSeoController.prototype, "getShare", null);
exports.ShareSeoController = ShareSeoController = __decorate([
    (0, common_1.Controller)('share'),
    __metadata("design:paramtypes", [share_service_1.ShareService,
        workspace_repo_1.WorkspaceRepo,
        environment_service_1.EnvironmentService])
], ShareSeoController);
//# sourceMappingURL=share-seo.controller.js.map