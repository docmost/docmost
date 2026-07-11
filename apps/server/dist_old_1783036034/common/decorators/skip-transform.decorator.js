"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipTransform = exports.SKIP_TRANSFORM_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_TRANSFORM_KEY = 'SKIP_TRANSFORM';
const SkipTransform = () => (0, common_1.SetMetadata)(exports.SKIP_TRANSFORM_KEY, true);
exports.SkipTransform = SkipTransform;
//# sourceMappingURL=skip-transform.decorator.js.map