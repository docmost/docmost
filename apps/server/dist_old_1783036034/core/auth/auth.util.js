"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEmailSignature = computeEmailSignature;
exports.throwIfEmailNotVerified = throwIfEmailNotVerified;
exports.validateSsoEnforcement = validateSsoEnforcement;
exports.validateAllowedEmail = validateAllowedEmail;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function computeEmailSignature(email, workspaceId, appSecret) {
    return (0, node_crypto_1.createHmac)('sha256', appSecret)
        .update(`${email.toLowerCase()}:${workspaceId}`)
        .digest('hex');
}
function throwIfEmailNotVerified(opts) {
    if (!opts.isCloud || opts.emailVerifiedAt)
        return;
    const emailSignature = computeEmailSignature(opts.email, opts.workspaceId, opts.appSecret);
    throw new common_1.BadRequestException({
        message: 'Please verify your email address. Check your inbox for the verification link.',
        emailSignature,
    });
}
function validateSsoEnforcement(workspace) {
    if (workspace.enforceSso) {
        throw new common_1.BadRequestException('This workspace has enforced SSO login.');
    }
}
function validateAllowedEmail(userEmail, workspace) {
    const emailParts = userEmail.split('@');
    const emailDomain = emailParts[1].toLowerCase();
    if (workspace.emailDomains?.length > 0 &&
        !workspace.emailDomains.includes(emailDomain)) {
        throw new common_1.BadRequestException(`The email domain "${emailDomain}" is not approved for this workspace.`);
    }
}
//# sourceMappingURL=auth.util.js.map