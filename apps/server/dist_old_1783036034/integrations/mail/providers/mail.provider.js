"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailDriverProvider = exports.mailDriverConfigProvider = void 0;
const environment_service_1 = require("../../environment/environment.service");
const interfaces_1 = require("../interfaces");
const drivers_1 = require("../drivers");
const mail_constants_1 = require("../mail.constants");
function createMailDriver(mail) {
    switch (mail.driver) {
        case interfaces_1.MailOption.SMTP:
            return new drivers_1.SmtpDriver(mail.config);
        case interfaces_1.MailOption.Postmark:
            return new drivers_1.PostmarkDriver(mail.config);
        case interfaces_1.MailOption.Log:
            return new drivers_1.LogDriver();
        default:
            throw new Error(`Unknown mail driver`);
    }
}
exports.mailDriverConfigProvider = {
    provide: mail_constants_1.MAIL_CONFIG_TOKEN,
    useFactory: async (environmentService) => {
        const driver = environmentService.getMailDriver().toLocaleLowerCase();
        switch (driver) {
            case interfaces_1.MailOption.SMTP: {
                let auth = undefined;
                if (environmentService.getSmtpUsername() &&
                    environmentService.getSmtpPassword()) {
                    auth = {
                        user: environmentService.getSmtpUsername(),
                        pass: environmentService.getSmtpPassword(),
                    };
                }
                return {
                    driver,
                    config: {
                        host: environmentService.getSmtpHost(),
                        port: environmentService.getSmtpPort(),
                        connectionTimeout: 30 * 1000,
                        auth,
                        secure: environmentService.getSmtpSecure(),
                        ignoreTLS: environmentService.getSmtpIgnoreTLS(),
                    },
                };
            }
            case interfaces_1.MailOption.Postmark:
                return {
                    driver,
                    config: {
                        postmarkToken: environmentService.getPostmarkToken(),
                    },
                };
            case interfaces_1.MailOption.Log:
                return {
                    driver,
                };
            default:
                throw new Error(`Unknown mail driver: ${driver}`);
        }
    },
    inject: [environment_service_1.EnvironmentService],
};
exports.mailDriverProvider = {
    provide: mail_constants_1.MAIL_DRIVER_TOKEN,
    useFactory: (config) => createMailDriver(config),
    inject: [mail_constants_1.MAIL_CONFIG_TOKEN],
};
//# sourceMappingURL=mail.provider.js.map