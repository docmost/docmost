"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findHighestUserSpaceRole = findHighestUserSpaceRole;
const permission_1 = require("../../../common/helpers/types/permission");
function findHighestUserSpaceRole(userSpaceRoles) {
    if (!userSpaceRoles) {
        return undefined;
    }
    const roleOrder = {
        [permission_1.SpaceRole.ADMIN]: 3,
        [permission_1.SpaceRole.WRITER]: 2,
        [permission_1.SpaceRole.READER]: 1,
    };
    let highestRole;
    for (const userSpaceRole of userSpaceRoles) {
        const currentRole = userSpaceRole.role;
        if (!highestRole || roleOrder[currentRole] > roleOrder[highestRole]) {
            highestRole = currentRole;
        }
    }
    return highestRole;
}
//# sourceMappingURL=utils.js.map