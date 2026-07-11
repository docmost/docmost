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
exports.VersionService = void 0;
const common_1 = require("@nestjs/common");
const packageJson = require('./../../../package.json');
let VersionService = class VersionService {
    constructor() { }
    async getVersion() {
        const url = `https://api.github.com/repos/docmost/docmost/releases/latest`;
        let latestVersion = 0;
        try {
            const response = await fetch(url);
            if (!response.ok)
                return;
            const data = await response.json();
            latestVersion = data?.tag_name?.replace('v', '');
        }
        catch (err) {
        }
        return {
            currentVersion: packageJson?.version,
            latestVersion: latestVersion,
            releaseUrl: 'https://github.com/docmost/docmost/releases',
        };
    }
};
exports.VersionService = VersionService;
exports.VersionService = VersionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], VersionService);
//# sourceMappingURL=version.service.js.map