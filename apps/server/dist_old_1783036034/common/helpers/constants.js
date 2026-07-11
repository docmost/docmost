"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_STORAGE_PATH = exports.APP_DATA_PATH = void 0;
exports.getPageTitle = getPageTitle;
const path = require("path");
exports.APP_DATA_PATH = 'data';
const LOCAL_STORAGE_DIR = `${exports.APP_DATA_PATH}/storage`;
exports.LOCAL_STORAGE_PATH = path.resolve(process.cwd(), '..', '..', LOCAL_STORAGE_DIR);
function getPageTitle(title) {
    return title || 'untitled';
}
//# sourceMappingURL=constants.js.map