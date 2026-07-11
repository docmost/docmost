"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const ChangePasswordEmail = ({ username }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "Hi ",
                username,
                ","),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "This is a confirmation that your password has been changed."))));
};
exports.ChangePasswordEmail = ChangePasswordEmail;
exports.default = exports.ChangePasswordEmail;
//# sourceMappingURL=change-password-email.js.map