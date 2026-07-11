"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageUpdateDigestEmail = void 0;
const react_email_1 = require("react-email");
const React = require("react");
const styles_1 = require("../css/styles");
const partials_1 = require("../partials/partials");
const PageUpdateDigestEmail = ({ userName, pageUpdates, totalUpdates, }) => {
    return (React.createElement(partials_1.MailBody, null,
        React.createElement(react_email_1.Section, { style: styles_1.content },
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "Hi ",
                (0, partials_1.getGreetingName)(userName),
                ","),
            React.createElement(react_email_1.Text, { style: styles_1.paragraph },
                "There ",
                totalUpdates === 1 ? 'has' : 'have',
                " been",
                ' ',
                React.createElement("strong", null,
                    totalUpdates,
                    " update",
                    totalUpdates === 1 ? '' : 's'),
                ' ',
                "since your last update."),
            pageUpdates.map((page, i) => (React.createElement(react_email_1.Section, { key: i, style: pageCard },
                React.createElement(react_email_1.Text, { style: pageTitle },
                    React.createElement(react_email_1.Link, { href: page.url, style: styles_1.link }, page.title)),
                page.updatedBy.length > 0 && (React.createElement(react_email_1.Text, { style: updatedByText },
                    "Edited by ",
                    page.updatedBy.join(', ')))))))));
};
exports.PageUpdateDigestEmail = PageUpdateDigestEmail;
const pageCard = {
    borderLeft: '3px solid #e8e5ef',
    paddingLeft: '12px',
    marginBottom: '12px',
};
const pageTitle = {
    ...styles_1.paragraph,
    margin: '0 0 2px 0',
    fontSize: 14,
    fontWeight: 'bold',
};
const updatedByText = {
    ...styles_1.paragraph,
    margin: '0',
    fontSize: 13,
    color: '#666',
};
exports.default = exports.PageUpdateDigestEmail;
//# sourceMappingURL=page-update-digest-email.js.map