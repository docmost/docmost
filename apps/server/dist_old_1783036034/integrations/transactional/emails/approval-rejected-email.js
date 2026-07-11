"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalRejectedEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const ApprovalRejectedEmail = ({ actorName, pageTitle, spaceName, pageUrl, comment, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " returned",
                ' ',
                React.createElement("strong", null, pageTitle),
                " in the",
                ' ',
                React.createElement("strong", null, spaceName),
                " space for revision."),
            comment && (React.createElement(react_email_1.Text, { style: { ...styles_1.paragraph, fontStyle: 'italic' } },
                "\u201C",
                comment,
                "\u201D"))),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "View page")));
};
exports.ApprovalRejectedEmail = ApprovalRejectedEmail;
exports.default = exports.ApprovalRejectedEmail;
//# sourceMappingURL=approval-rejected-email.js.map