"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggerExtension_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerExtension = void 0;
const common_1 = require("@nestjs/common");
let LoggerExtension = LoggerExtension_1 = class LoggerExtension {
    constructor() {
        this.logger = new common_1.Logger('Collab' + LoggerExtension_1.name);
    }
    async afterUnloadDocument(data) {
        this.logger.debug('Unloaded ' + data.documentName + ' from memory');
    }
    async onDisconnect(data) {
        this.logger.debug('User disconnected from ' + data.documentName);
    }
};
exports.LoggerExtension = LoggerExtension;
exports.LoggerExtension = LoggerExtension = LoggerExtension_1 = __decorate([
    (0, common_1.Injectable)()
], LoggerExtension);
//# sourceMappingURL=logger.extension.js.map