"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogDriver = void 0;
const common_1 = require("@nestjs/common");
const mail_utils_1 = require("../mail.utils");
const process = require("node:process");
class LogDriver {
    constructor() {
        this.logger = new common_1.Logger((0, mail_utils_1.mailLogName)(LogDriver.name));
    }
    async sendMail(message) {
        if (process.env.NODE_ENV === 'production') {
            return;
        }
        const mailLog = {
            to: message.to,
            subject: message.subject,
            text: message.text,
        };
        this.logger.log(`Logged email: ${JSON.stringify(mailLog)}`);
    }
}
exports.LogDriver = LogDriver;
//# sourceMappingURL=log.driver.js.map