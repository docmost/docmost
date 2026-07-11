"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailBody = MailBody;
exports.MailHeader = MailHeader;
exports.EmailButton = EmailButton;
exports.MailFooter = MailFooter;
exports.getGreetingName = getGreetingName;
const styles_1 = require("../css/styles");
const react_email_1 = require("react-email");
const React = require("react");
function MailBody({ children }) {
    return (React.createElement(react_email_1.Html, null,
        React.createElement(react_email_1.Head, null),
        React.createElement(react_email_1.Body, { style: styles_1.main },
            React.createElement(MailHeader, null),
            React.createElement(react_email_1.Container, { style: styles_1.container }, children),
            React.createElement(MailFooter, null))));
}
function MailHeader() {
    return (React.createElement(react_email_1.Section, { style: styles_1.logo }));
}
function EmailButton({ href, children }) {
    return (React.createElement("table", { role: "presentation", cellPadding: "0", cellSpacing: "0", style: { margin: '0 0 15px 15px' } },
        React.createElement("tr", null,
            React.createElement("td", { style: {
                    backgroundColor: styles_1.button.backgroundColor,
                    borderRadius: styles_1.button.borderRadius,
                    textAlign: 'center',
                } },
                React.createElement("a", { href: href, target: "_blank", style: {
                        color: styles_1.button.color,
                        fontFamily: styles_1.button.fontFamily,
                        fontSize: styles_1.button.fontSize,
                        textDecoration: 'none',
                        display: 'inline-block',
                        padding: '8px 16px',
                    } }, children)))));
}
function MailFooter() {
    return (React.createElement(react_email_1.Section, { style: styles_1.footer },
        React.createElement(react_email_1.Row, null,
            React.createElement(react_email_1.Text, { style: { textAlign: 'center', color: '#706a7b' } },
                "\u00A9 ",
                new Date().getFullYear(),
                " Docmost, All Rights Reserved ",
                React.createElement("br", null)))));
}
function getGreetingName(name) {
    return name?.split(' ')[0] || 'there';
}
//# sourceMappingURL=partials.js.map