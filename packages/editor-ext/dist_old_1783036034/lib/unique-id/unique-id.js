"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueID = void 0;
const utils_1 = require("../utils");
const extension_unique_id_1 = require("@tiptap/extension-unique-id");
exports.UniqueID = extension_unique_id_1.UniqueID.extend({
    addOptions() {
        return {
            ...this.parent?.(),
            generateID: () => (0, utils_1.generateNodeId)(),
        };
    },
});
//# sourceMappingURL=unique-id.js.map