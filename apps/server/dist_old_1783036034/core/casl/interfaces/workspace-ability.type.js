"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceCaslSubject = exports.WorkspaceCaslAction = void 0;
var WorkspaceCaslAction;
(function (WorkspaceCaslAction) {
    WorkspaceCaslAction["Manage"] = "manage";
    WorkspaceCaslAction["Create"] = "create";
    WorkspaceCaslAction["Read"] = "read";
    WorkspaceCaslAction["Edit"] = "edit";
    WorkspaceCaslAction["Delete"] = "delete";
})(WorkspaceCaslAction || (exports.WorkspaceCaslAction = WorkspaceCaslAction = {}));
var WorkspaceCaslSubject;
(function (WorkspaceCaslSubject) {
    WorkspaceCaslSubject["Settings"] = "settings";
    WorkspaceCaslSubject["Member"] = "member";
    WorkspaceCaslSubject["Space"] = "space";
    WorkspaceCaslSubject["Group"] = "group";
    WorkspaceCaslSubject["Attachment"] = "attachment";
    WorkspaceCaslSubject["API"] = "api_key";
    WorkspaceCaslSubject["Audit"] = "audit";
})(WorkspaceCaslSubject || (exports.WorkspaceCaslSubject = WorkspaceCaslSubject = {}));
//# sourceMappingURL=workspace-ability.type.js.map