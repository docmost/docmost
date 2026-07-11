"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MailModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailModule = void 0;
const common_1 = require("@nestjs/common");
const mail_provider_1 = require("./providers/mail.provider");
const mail_service_1 = require("./mail.service");
const email_processor_1 = require("./processors/email.processor");
let MailModule = MailModule_1 = class MailModule {
    static forRootAsync(options) {
        return {
            module: MailModule_1,
            imports: options.imports || [],
            providers: [mail_provider_1.mailDriverConfigProvider, mail_provider_1.mailDriverProvider, mail_service_1.MailService],
            exports: [mail_service_1.MailService],
        };
    }
};
exports.MailModule = MailModule;
exports.MailModule = MailModule = MailModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [email_processor_1.EmailProcessor],
    })
], MailModule);
//# sourceMappingURL=mail.module.js.map