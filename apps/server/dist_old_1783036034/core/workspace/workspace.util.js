"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminActingOnOwner = isAdminActingOnOwner;
const permission_1 = require("../../common/helpers/types/permission");
function isAdminActingOnOwner(authUserRole, targetRole) {
    return authUserRole === permission_1.UserRole.ADMIN && targetRole === permission_1.UserRole.OWNER;
}
//# sourceMappingURL=workspace.util.js.map