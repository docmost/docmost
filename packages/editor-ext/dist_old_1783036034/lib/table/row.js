"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableRow = void 0;
const extension_table_1 = require("@tiptap/extension-table");
exports.TableRow = extension_table_1.TableRow.extend({
    content: "(tableCell | tableHeader)*",
});
//# sourceMappingURL=row.js.map