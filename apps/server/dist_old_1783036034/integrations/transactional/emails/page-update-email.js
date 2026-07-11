"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageUpdateEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const PageUpdateEmail = ({ userName, actorName, pageTitle, pageUrl, spaceName, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "Hi ",
                (0, partials_1.getGreetingName)(userName),
                ","),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                React.createElement("strong", null, actorName),
                " updated",
                ' ',
                React.createElement(react_email_1.Link, { href: pageUrl, style: styles_1.link },
                    React.createElement("strong", null, pageTitle)),
                ' ',
                "in the ",
                React.createElement("strong", null, spaceName),
                " space.")),
        React.createElement(partials_1.EmailButton, { href: pageUrl }, "View page")));
};
exports.PageUpdateEmail = PageUpdateEmail;
exports.default = exports.PageUpdateEmail;
//# sourceMappingURL=page-update-email.js.map