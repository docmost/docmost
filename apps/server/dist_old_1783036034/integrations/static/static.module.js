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
exports.StaticModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const path_1 = require("path");
const fs = require("node:fs");
const static_1 = require("@fastify/static");
const environment_service_1 = require("../environment/environment.service");
let StaticModule = class StaticModule {
    constructor(httpAdapterHost, environmentService) {
        this.httpAdapterHost = httpAdapterHost;
        this.environmentService = environmentService;
    }
    async onModuleInit() {
        const httpAdapter = this.httpAdapterHost.httpAdapter;
        const app = httpAdapter.getInstance();
        const clientDistPath = (0, path_1.join)(__dirname, '..', '..', '..', '..', 'client/dist');
        const indexFilePath = (0, path_1.join)(clientDistPath, 'index.html');
        if (fs.existsSync(clientDistPath) && fs.existsSync(indexFilePath)) {
            const indexTemplateFilePath = (0, path_1.join)(clientDistPath, 'index-template.html');
            const windowVar = '<!--window-config-->';
            const configString = {
                ENV: this.environmentService.getNodeEnv(),
                APP_URL: this.environmentService.getAppUrl(),
                CLOUD: this.environmentService.isCloud(),
                FILE_UPLOAD_SIZE_LIMIT: this.environmentService.getFileUploadSizeLimit(),
                FILE_IMPORT_SIZE_LIMIT: this.environmentService.getFileImportSizeLimit(),
                DRAWIO_URL: this.environmentService.getDrawioUrl(),
                SUBDOMAIN_HOST: this.environmentService.isCloud()
                    ? this.environmentService.getSubdomainHost()
                    : undefined,
                COLLAB_URL: this.environmentService.getCollabUrl(),
                BILLING_TRIAL_DAYS: this.environmentService.isCloud()
                    ? this.environmentService.getBillingTrialDays()
                    : undefined,
                POSTHOG_HOST: this.environmentService.getPostHogHost(),
                POSTHOG_KEY: this.environmentService.getPostHogKey(),
            };
            const windowScriptContent = `<script>window.CONFIG=${JSON.stringify(configString)};</script>`;
            if (!fs.existsSync(indexTemplateFilePath)) {
                fs.copyFileSync(indexFilePath, indexTemplateFilePath);
            }
            const html = fs.readFileSync(indexTemplateFilePath, 'utf8');
            const transformedHtml = html.replace(windowVar, windowScriptContent);
            fs.writeFileSync(indexFilePath, transformedHtml);
            const RENDER_PATH = '*';
            await app.register(static_1.default, {
                root: clientDistPath,
                wildcard: false,
            });
            app.get(RENDER_PATH, (req, res) => {
                const stream = fs.createReadStream(indexFilePath);
                res
                    .header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    .type('text/html')
                    .send(stream);
            });
        }
    }
};
exports.StaticModule = StaticModule;
exports.StaticModule = StaticModule = __decorate([
    (0, common_1.Module)({}),
    __metadata("design:paramtypes", [core_1.HttpAdapterHost,
        environment_service_1.EnvironmentService])
], StaticModule);
//# sourceMappingURL=static.module.js.map