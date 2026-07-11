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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateRepo = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const utils_1 = require("../../utils");
const cursor_pagination_1 = require("../../pagination/cursor-pagination");
const kysely_1 = require("kysely");
const postgres_1 = require("kysely/helpers/postgres");
let TemplateRepo = class TemplateRepo {
    constructor(db) {
        this.db = db;
        this.baseFields = [
            'id',
            'title',
            'description',
            'icon',
            'spaceId',
            'workspaceId',
            'creatorId',
            'lastUpdatedById',
            'createdAt',
            'updatedAt',
        ];
    }
    async findById(templateId, workspaceId, opts) {
        const db = (0, utils_1.dbOrTx)(this.db, opts?.trx);
        const query = db
            .selectFrom('templates')
            .select(this.baseFields)
            .$if(opts?.includeContent ?? false, (qb) => qb.select('content'))
            .select((eb) => [this.withCreator(eb)])
            .where('id', '=', templateId)
            .where('workspaceId', '=', workspaceId);
        return query.executeTakeFirst();
    }
    async findTemplates(workspaceId, accessibleSpaceIds, pagination, opts) {
        let query = this.db
            .selectFrom('templates')
            .select(this.baseFields)
            .select((eb) => [this.withCreator(eb)])
            .where('workspaceId', '=', workspaceId);
        if (opts?.spaceId) {
            if (!accessibleSpaceIds.includes(opts.spaceId)) {
                query = query.where((0, kysely_1.sql) `false`);
            }
            else {
                query = query.where('spaceId', '=', opts.spaceId);
            }
        }
        else {
            query = query.where((eb) => eb.or([
                eb('spaceId', 'is', null),
                ...(accessibleSpaceIds.length > 0
                    ? [eb('spaceId', 'in', accessibleSpaceIds)]
                    : []),
            ]));
        }
        if (pagination.query) {
            const searchTerm = `%${pagination.query}%`;
            query = query.where((eb) => eb.or([
                eb((0, kysely_1.sql) `f_unaccent(title)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${searchTerm})`),
                eb((0, kysely_1.sql) `f_unaccent(description)`, 'ilike', (0, kysely_1.sql) `f_unaccent(${searchTerm})`),
            ]));
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [
                { expression: 'title', direction: 'asc' },
                { expression: 'id', direction: 'asc' },
            ],
            parseCursor: (cursor) => ({
                title: cursor.title,
                id: cursor.id,
            }),
        });
    }
    async insertTemplate(insertableTemplate, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        return db
            .insertInto('templates')
            .values(insertableTemplate)
            .returning('id')
            .executeTakeFirst();
    }
    async updateTemplate(updatableTemplate, templateId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .updateTable('templates')
            .set({ ...updatableTemplate, updatedAt: new Date() })
            .where('id', '=', templateId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    async deleteTemplate(templateId, workspaceId, trx) {
        const db = (0, utils_1.dbOrTx)(this.db, trx);
        await db
            .deleteFrom('templates')
            .where('id', '=', templateId)
            .where('workspaceId', '=', workspaceId)
            .execute();
    }
    withCreator(eb) {
        return (0, postgres_1.jsonObjectFrom)(eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'templates.creatorId')).as('creator');
    }
};
exports.TemplateRepo = TemplateRepo;
exports.TemplateRepo = TemplateRepo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], TemplateRepo);
//# sourceMappingURL=template.repo.js.map