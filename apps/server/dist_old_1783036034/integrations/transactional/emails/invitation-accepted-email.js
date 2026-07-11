"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationAcceptedEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const InvitationAcceptedEmail = ({ invitedUserName, invitedUserEmail, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                invitedUserName,
                " (",
                invitedUserEmail,
                ") has accepted your invitation, and is now a member of the workspace."))));
};
exports.InvitationAcceptedEmail = InvitationAcceptedEmail;
exports.default = exports.InvitationAcceptedEmail;
//# sourceMappingURL=invitation-accepted-email.js.map