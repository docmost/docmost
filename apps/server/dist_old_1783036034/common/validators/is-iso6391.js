"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IS_ISO6391 = void 0;
exports.isISO6391 = isISO6391;
exports.IsISO6391 = IsISO6391;
const isISO6391_1 = require("validator/lib/isISO6391");
const class_validator_1 = require("class-validator");
exports.IS_ISO6391 = 'isISO6391';
function isISO6391(value) {
    return typeof value === 'string' && (0, isISO6391_1.default)(value);
}
function IsISO6391(validationOptions) {
    return (0, class_validator_1.ValidateBy)({
        name: exports.IS_ISO6391,
        validator: {
            validate: (value, args) => isISO6391(value),
            defaultMessage: (0, class_validator_1.buildMessage)((eachPrefix) => eachPrefix + '$property must be a valid ISO 639-1 language code', validationOptions),
        },
    }, validationOptions);
}
//# sourceMappingURL=is-iso6391.js.map