"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationExpiredEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const VerificationExpiredEmail = ({ pageTitle, spaceName, pageUrl }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "The verification for ",
                React.createElement("strong", null, pageTitle),
                " in the",
                ' ',
                React.createElement("strong", null, spaceName),
                " space has expired. Please re-verify the page to confirm it is still accurate.")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "Re-verify page")));
};
exports.VerificationExpiredEmail = VerificationExpiredEmail;
exports.default = exports.VerificationExpiredEmail;
//# sourceMappingURL=verification-expired-email.js.map