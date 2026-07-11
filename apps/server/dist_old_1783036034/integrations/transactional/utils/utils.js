"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = void 0;
const formatDate = (date) => {
    new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
};
exports.formatDate = formatDate;
//# sourceMappingURL=utils.js.map