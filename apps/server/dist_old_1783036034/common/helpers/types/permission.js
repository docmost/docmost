"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePermissionRole = exports.PageAccessLevel = exports.SpaceVisibility = exports.SpaceRole = exports.InviteUserRole = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "owner";
    UserRole["ADMIN"] = "admin";
    UserRole["MEMBER"] = "member";
})(UserRole || (exports.UserRole = UserRole = {}));
var InviteUserRole;
(function (InviteUserRole) {
    InviteUserRole["ADMIN"] = "admin";
    InviteUserRole["MEMBER"] = "member";
})(InviteUserRole || (exports.InviteUserRole = InviteUserRole = {}));
var SpaceRole;
(function (SpaceRole) {
    SpaceRole["ADMIN"] = "admin";
    SpaceRole["WRITER"] = "writer";
    SpaceRole["READER"] = "reader";
})(SpaceRole || (exports.SpaceRole = SpaceRole = {}));
var SpaceVisibility;
(function (SpaceVisibility) {
    SpaceVisibility["OPEN"] = "open";
    SpaceVisibility["PRIVATE"] = "private";
})(SpaceVisibility || (exports.SpaceVisibility = SpaceVisibility = {}));
var PageAccessLevel;
(function (PageAccessLevel) {
    PageAccessLevel["RESTRICTED"] = "restricted";
})(PageAccessLevel || (exports.PageAccessLevel = PageAccessLevel = {}));
var PagePermissionRole;
(function (PagePermissionRole) {
    PagePermissionRole["READER"] = "reader";
    PagePermissionRole["WRITER"] = "writer";
})(PagePermissionRole || (exports.PagePermissionRole = PagePermissionRole = {}));
//# sourceMappingURL=permission.js.map