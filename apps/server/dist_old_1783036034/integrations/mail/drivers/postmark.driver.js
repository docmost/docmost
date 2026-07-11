"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostmarkDriver = void 0;
const postmark_1 = require("postmark");
const common_1 = require("@nestjs/common");
const mail_utils_1 = require("../mail.utils");
class PostmarkDriver {
    constructor(config) {
        this.logger = new common_1.Logger((0, mail_utils_1.mailLogName)(PostmarkDriver.name));
        this.postmarkClient = new postmark_1.ServerClient(config.postmarkToken);
    }
    async sendMail(message) {
        try {
            await this.postmarkClient.sendEmail({
                From: message.from,
                To: message.to,
                Subject: message.subject,
                TextBody: message.text,
                HtmlBody: message.html,
            });
            this.logger.debug(`Sent mail to ${message.to}`);
        }
        catch (err) {
            this.logger.warn(`Failed to send mail to ${message.to}: ${err}`);
            throw err;
        }
    }
}
exports.PostmarkDriver = PostmarkDriver;
//# sourceMappingURL=postmark.driver.js.map