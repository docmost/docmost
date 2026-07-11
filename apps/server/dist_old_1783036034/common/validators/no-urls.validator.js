"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsDomain = containsDomain;
exports.NoUrls = NoUrls;
const class_validator_1 = require("class-validator");
const tlds = require("tlds");
const URL_PATTERN = /https?:\/\//i;
const tldSet = new Set(tlds.map((t) => t.toLowerCase()));
function containsDomain(value) {
    const tokens = value.split(/\s+/);
    for (const token of tokens) {
        if (token.includes('@'))
            continue;
        const segments = token.split('.');
        for (let i = 1; i < segments.length; i++) {
            const suffix = segments[i].replace(/[^\w].*/g, '');
            if (segments[i - 1] && suffix && tldSet.has(suffix.toLowerCase())) {
                return true;
            }
        }
    }
    return false;
}
function NoUrls(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'noUrls',
            target: object.constructor,
            propertyName,
            options: {
                message: 'Must not contain URLs or domain names',
                ...validationOptions,
            },
            validator: {
                validate(value) {
                    if (typeof value !== 'string')
                        return true;
                    if (URL_PATTERN.test(value))
                        return false;
                    if (containsDomain(value))
                        return false;
                    return true;
                },
            },
        });
    };
}
//# sourceMappingURL=no-urls.validator.js.map