"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const InvitationEmail = ({ inviteLink }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "You have been invited to Docmost."),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Please click the button below to accept this invitation.")),
        React.createElement(partials_1.EmailButton, { href: inviteLink }, "Accept Invite")));
};
exports.InvitationEmail = InvitationEmail;
exports.default = exports.InvitationEmail;
//# sourceMappingURL=invitation-email.js.map