"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthWorkspace = void 0;
const common_1 = require("@nestjs/common");
exports.AuthWorkspace = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const workspace = request.raw?.workspace ?? request?.user?.workspace;
    if (!workspace) {
        throw new common_1.BadRequestException('Invalid workspace');
    }
    return workspace;
});
//# sourceMappingURL=auth-workspace.decorator.js.map