"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopAuditService = exports.AUDIT_SERVICE = void 0;
const common_1 = require("@nestjs/common");
exports.AUDIT_SERVICE = Symbol('AUDIT_SERVICE');
let NoopAuditService = class NoopAuditService {
    log(_payload) {
    }
    logWithContext(_payload, _context) {
    }
    logBatchWithContext(_payloads, _context) {
    }
    setActorId(_actorId) {
    }
    setActorType(_actorType) {
    }
    updateRetention(_workspaceId, _retentionDays) {
    }
};
exports.NoopAuditService = NoopAuditService;
exports.NoopAuditService = NoopAuditService = __decorate([
    (0, common_1.Injectable)()
], NoopAuditService);
//# sourceMappingURL=audit.service.js.map