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
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const mail_constants_1 = require("./mail.constants");
const environment_service_1 = require("../environment/environment.service");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../queue/constants");
const bullmq_2 = require("bullmq");
const react_email_1 = require("react-email");
let MailService = class MailService {
    constructor(mailDriver, environmentService, emailQueue) {
        this.mailDriver = mailDriver;
        this.environmentService = environmentService;
        this.emailQueue = emailQueue;
    }
    async sendEmail(message) {
        if (this.isRecipientBlocked(message.to)) {
            return;
        }
        if (message.template) {
            message.html = await (0, react_email_1.render)(message.template, {
                pretty: true,
            });
            message.text = await (0, react_email_1.render)(message.template, { plainText: true });
        }
        let from = this.environmentService.getMailFromAddress();
        if (message.from) {
            from = message.from;
        }
        const sender = `${this.environmentService.getMailFromName()} <${from}> `;
        await this.mailDriver.sendMail({ from: sender, ...message });
    }
    async sendToQueue(message) {
        if (this.isRecipientBlocked(message.to)) {
            return;
        }
        if (message.template) {
            message.html = await (0, react_email_1.render)(message.template, {
                pretty: true,
            });
            message.text = await (0, react_email_1.render)(message.template, {
                plainText: true,
            });
            delete message.template;
        }
        await this.emailQueue.add(constants_1.QueueJob.SEND_EMAIL, message);
    }
    isRecipientBlocked(to) {
        const blocked = this.environmentService.getMailBlockedRecipientDomains();
        if (blocked.length === 0)
            return false;
        const domain = to?.split('@')[1]?.toLowerCase();
        return !!domain && blocked.includes(domain);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(mail_constants_1.MAIL_DRIVER_TOKEN)),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.QueueName.EMAIL_QUEUE)),
    __metadata("design:paramtypes", [Object, environment_service_1.EnvironmentService,
        bullmq_2.Queue])
], MailService);
//# sourceMappingURL=mail.service.js.map