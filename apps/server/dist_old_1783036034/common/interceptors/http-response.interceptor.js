"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformHttpResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const core_1 = require("@nestjs/core");
const skip_transform_decorator_1 = require("../decorators/skip-transform.decorator");
let TransformHttpResponseInterceptor = class TransformHttpResponseInterceptor {
    constructor(reflector) {
        this.reflector = reflector;
    }
    intercept(context, next) {
        const skipTransform = this.reflector.get(skip_transform_decorator_1.SKIP_TRANSFORM_KEY, context.getHandler());
        if (skipTransform) {
            return next.handle();
        }
        return next.handle().pipe((0, rxjs_1.map)((data) => {
            const status = context.switchToHttp().getResponse().statusCode;
            return { data, success: true, status };
        }));
    }
};
exports.TransformHttpResponseInterceptor = TransformHttpResponseInterceptor;
exports.TransformHttpResponseInterceptor = TransformHttpResponseInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], TransformHttpResponseInterceptor);
//# sourceMappingURL=http-response.interceptor.js.map