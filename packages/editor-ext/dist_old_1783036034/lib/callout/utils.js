"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidCalloutType = getValidCalloutType;
const validCalloutTypes = [
    'default',
    'info',
    'note',
    'success',
    'warning',
    'danger',
];
function getValidCalloutType(value) {
    if (value) {
        return validCalloutTypes.includes(value) ? value : 'info';
    }
}
//# sourceMappingURL=utils.js.map