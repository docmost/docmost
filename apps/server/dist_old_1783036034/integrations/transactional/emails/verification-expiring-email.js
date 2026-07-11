"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationExpiringEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const VerificationExpiringEmail = ({ pageTitle, spaceName, pageUrl, expiresAt, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "The page ",
                React.createElement("strong", null, pageTitle),
                " in the",
                ' ',
                React.createElement("strong", null, spaceName),
                " space needs to be re-verified. The verification expires on ",
                React.createElement("strong", null, expiresAt),
                ".")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "Review page")));
};
exports.VerificationExpiringEmail = VerificationExpiringEmail;
exports.default = exports.VerificationExpiringEmail;
//# sourceMappingURL=verification-expiring-email.js.map