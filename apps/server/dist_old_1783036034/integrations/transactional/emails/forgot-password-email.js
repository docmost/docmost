"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const ForgotPasswordEmail = ({ username, resetLink }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "Hi ",
                username,
                ","),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "We received a request from you to reset your password."),
            React.createElement(react_email_1.Link, { href: resetLink }, " Click here to set a new password"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "This link is valid for 30 minutes."),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "If you did not request a password reset, please ignore this email."))));
};
exports.ForgotPasswordEmail = ForgotPasswordEmail;
exports.default = exports.ForgotPasswordEmail;
//# sourceMappingURL=forgot-password-email.js.map