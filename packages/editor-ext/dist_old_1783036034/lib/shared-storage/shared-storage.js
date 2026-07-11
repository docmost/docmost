"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedStorage = void 0;
const core_1 = require("@tiptap/core");
const SharedStorage = core_1.Extension.create({
    name: "shared",
    addStorage() {
        return {};
    },
});
exports.SharedStorage = SharedStorage;
//# sourceMappingURL=shared-storage.js.map