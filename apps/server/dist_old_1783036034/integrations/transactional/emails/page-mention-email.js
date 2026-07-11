"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageMentionEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const PageMentionEmail = ({ actorName, pageTitle, pageUrl }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " mentioned you in",
                ' ',
                React.createElement("strong", null, pageTitle),
                ".")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "View")));
};
exports.PageMentionEmail = PageMentionEmail;
exports.default = exports.PageMentionEmail;
//# sourceMappingURL=page-mention-email.js.map