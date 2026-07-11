"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGrantedEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const PermissionGrantedEmail = ({ actorName, pageTitle, pageUrl, accessLabel, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph }, "Hi there,"),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " gave you ",
                accessLabel,
                " access to",
                ' ',
                React.createElement("strong", null, pageTitle),
                ".")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "View")));
};
exports.PermissionGrantedEmail = PermissionGrantedEmail;
exports.default = exports.PermissionGrantedEmail;
//# sourceMappingURL=permission-granted-email.js.map