"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlugId = exports.nanoIdGen = void 0;
const nanoid_1 = require("nanoid");
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
exports.nanoIdGen = (0, nanoid_1.customAlphabet)(alphabet, 10);
const slugIdAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
exports.generateSlugId = (0, nanoid_1.customAlphabet)(slugIdAlphabet, 10);
//# sourceMappingURL=nanoid.utils.js.map