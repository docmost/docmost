"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUser = void 0;
const common_1 = require("@nestjs/common");
exports.AuthUser = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request?.user?.user) {
        throw new common_1.BadRequestException('Invalid User');
    }
    return request.user.user;
});
//# sourceMappingURL=auth-user.decorator.js.map