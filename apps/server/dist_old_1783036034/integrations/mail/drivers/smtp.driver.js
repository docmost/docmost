"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmtpDriver = void 0;
const nodemailer = require("nodemailer");
const common_1 = require("@nestjs/common");
const mail_utils_1 = require("../mail.utils");
class SmtpDriver {
    constructor(config) {
        this.logger = new common_1.Logger((0, mail_utils_1.mailLogName)(SmtpDriver.name));
        this.transporter = nodemailer.createTransport(config);
    }
    async sendMail(message) {
        try {
            await this.transporter.sendMail({
                from: message.from,
                to: message.to,
                subject: message.subject,
                text: message.text,
                html: message.html,
            });
            this.logger.debug(`Sent mail to ${message.to}`);
        }
        catch (err) {
            this.logger.warn(`Failed to send mail to ${message.to}: ${err}`);
            throw err;
        }
    }
}
exports.SmtpDriver = SmtpDriver;
//# sourceMappingURL=smtp.driver.js.map