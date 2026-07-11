"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalRequestedEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const ApprovalRequestedEmail = ({ actorName, pageTitle, spaceName, pageUrl, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " submitted",
                ' ',
                React.createElement("strong", null, pageTitle),
                " in the",
                ' ',
                React.createElement("strong", null, spaceName),
                " space for your approval.")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "Review page")));
};
exports.ApprovalRequestedEmail = ApprovalRequestedEmail;
exports.default = exports.ApprovalRequestedEmail;
//# sourceMappingURL=approval-requested-email.js.map