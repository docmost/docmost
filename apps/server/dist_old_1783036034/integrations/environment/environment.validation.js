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
exports.EnvironmentVariables = void 0;
exports.validate = validate;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const is_iso6391_1 = require("../../common/validators/is-iso6391");
class EnvironmentVariables {
}
exports.EnvironmentVariables = EnvironmentVariables;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUrl)({
        protocols: ['postgres', 'postgresql'],
        require_tld: false,
        allow_underscores: true,
    }, { message: 'DATABASE_URL must be a valid postgres connection string' }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "DATABASE_URL", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUrl)({
        protocols: ['redis', 'rediss'],
        require_tld: false,
        allow_underscores: true,
    }, { message: 'REDIS_URL must be a valid redis connection string' }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "REDIS_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_tld: false }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "APP_URL", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(32),
    (0, class_validator_1.IsNotIn)(['REPLACE_WITH_LONG_SECRET']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "APP_SECRET", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['smtp', 'postmark']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "MAIL_DRIVER", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['local', 's3', 'azure']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "STORAGE_DRIVER", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.COLLAB_URL != '' && obj.COLLAB_URL != null),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_tld: false }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "COLLAB_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], EnvironmentVariables.prototype, "CLOUD", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ protocols: [], require_tld: true }, {
        message: 'SUBDOMAIN_HOST must be a valid FQDN domain without the http protocol. e.g example.com',
    }),
    (0, class_validator_1.ValidateIf)((obj) => obj.CLOUD === 'true'.toLowerCase()),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SUBDOMAIN_HOST", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['database', 'typesense']),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SEARCH_DRIVER", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({
        protocols: ['http', 'https'],
        require_tld: false,
        allow_underscores: true,
    }, {
        message: 'TYPESENSE_URL must be a valid typesense url e.g http://localhost:8108',
    }),
    (0, class_validator_1.ValidateIf)((obj) => obj.SEARCH_DRIVER === 'typesense'),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "TYPESENSE_URL", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.SEARCH_DRIVER === 'typesense'),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "TYPESENSE_API_KEY", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.SEARCH_DRIVER === 'typesense'),
    (0, is_iso6391_1.IsISO6391)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "TYPESENSE_LOCALE", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER),
    (0, class_validator_1.IsIn)(['openai', 'openai-compatible', 'gemini', 'ollama']),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "AI_DRIVER", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "AI_EMBEDDING_MODEL", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_EMBEDDING_DIMENSION),
    (0, class_validator_1.IsIn)(['768', '1024', '1536', '2000', '3072']),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "AI_EMBEDDING_DIMENSION", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_EMBEDDING_SUPPORTS_MRL),
    (0, class_validator_1.IsIn)(['true', 'false']),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "AI_EMBEDDING_SUPPORTS_MRL", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "AI_COMPLETION_MODEL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER && ['openai', 'openai-compatible'].includes(obj.AI_DRIVER)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "OPENAI_API_KEY", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER === 'openai-compatible' ||
        (obj.AI_DRIVER === 'openai' && obj.OPENAI_API_URL)),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_tld: false }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "OPENAI_API_URL", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER && obj.AI_DRIVER === 'gemini'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "GEMINI_API_KEY", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.AI_DRIVER && obj.AI_DRIVER === 'ollama'),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_tld: false }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "OLLAMA_API_URL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['postgres', 'clickhouse']),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "EVENT_STORE_DRIVER", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((obj) => obj.EVENT_STORE_DRIVER === 'clickhouse'),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_tld: false }, {
        message: 'CLICKHOUSE_URL must be a valid URL e.g http://user:password@localhost:8123/docmost',
    }),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "CLICKHOUSE_URL", void 0);
function validate(config) {
    const validatedConfig = (0, class_transformer_1.plainToInstance)(EnvironmentVariables, config);
    const errors = (0, class_validator_1.validateSync)(validatedConfig);
    if (errors.length > 0) {
        console.error('The Environment variables has failed the following validations:');
        errors.map((error) => {
            console.error(JSON.stringify(error.constraints));
        });
        console.error('Please fix the environment variables and try again. Exiting program...');
        process.exit(1);
    }
    return validatedConfig;
}
//# sourceMappingURL=environment.validation.js.map