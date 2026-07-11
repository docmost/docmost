"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentMentionEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const CommentMentionEmail = ({ actorName, pageTitle, pageUrl, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " mentioned you in a comment on",
                ' ',
                React.createElement("strong", null, pageTitle),
                ".")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "View")));
};
exports.CommentMentionEmail = CommentMentionEmail;
exports.default = exports.CommentMentionEmail;
//# sourceMappingURL=comment-mention-email.js.map