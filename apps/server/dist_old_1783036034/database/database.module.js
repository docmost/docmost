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
var DatabaseModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const environment_service_1 = require("../integrations/environment/environment.service");
const kysely_1 = require("kysely");
const group_repo_1 = require("./repos/group/group.repo");
const workspace_repo_1 = require("./repos/workspace/workspace.repo");
const user_repo_1 = require("./repos/user/user.repo");
const group_user_repo_1 = require("./repos/group/group-user.repo");
const space_repo_1 = require("./repos/space/space.repo");
const space_member_repo_1 = require("./repos/space/space-member.repo");
const page_repo_1 = require("./repos/page/page.repo");
const page_permission_repo_1 = require("./repos/page/page-permission.repo");
const comment_repo_1 = require("./repos/comment/comment.repo");
const page_transclusions_repo_1 = require("./repos/page-transclusions/page-transclusions.repo");
const page_transclusion_references_repo_1 = require("./repos/page-transclusions/page-transclusion-references.repo");
const page_history_repo_1 = require("./repos/page/page-history.repo");
const attachment_repo_1 = require("./repos/attachment/attachment.repo");
const process = require("node:process");
const migration_service_1 = require("./services/migration.service");
const user_token_repo_1 = require("./repos/user-token/user-token.repo");
const user_session_repo_1 = require("./repos/session/user-session.repo");
const backlink_repo_1 = require("./repos/backlink/backlink.repo");
const share_repo_1 = require("./repos/share/share.repo");
const notification_repo_1 = require("./repos/notification/notification.repo");
const watcher_repo_1 = require("./repos/watcher/watcher.repo");
const label_repo_1 = require("./repos/label/label.repo");
const favorite_repo_1 = require("./repos/favorite/favorite.repo");
const template_repo_1 = require("./repos/template/template.repo");
const page_listener_1 = require("./listeners/page.listener");
const kysely_postgres_js_1 = require("kysely-postgres-js");
const postgres = require("postgres");
const helpers_1 = require("../common/helpers");
let DatabaseModule = DatabaseModule_1 = class DatabaseModule {
    constructor(db, migrationService, environmentService) {
        this.db = db;
        this.migrationService = migrationService;
        this.environmentService = environmentService;
        this.logger = new common_1.Logger(DatabaseModule_1.name);
    }
    async onApplicationBootstrap() {
        await this.establishConnection();
        if (this.environmentService.getNodeEnv() === 'production') {
            await this.migrationService.migrateToLatest();
        }
    }
    async establishConnection() {
        const retryAttempts = 15;
        const retryDelay = 3000;
        this.logger.log('Establishing database connection');
        for (let i = 0; i < retryAttempts; i++) {
            try {
                await (0, kysely_1.sql) `SELECT 1=1`.execute(this.db);
                this.logger.log('Database connection successful');
                break;
            }
            catch (err) {
                if (err['errors']) {
                    this.logger.error(err['errors'][0]);
                }
                else {
                    this.logger.error(err);
                }
                if (i < retryAttempts - 1) {
                    this.logger.log(`Retrying [${i + 1}/${retryAttempts}] in ${retryDelay / 1000} seconds`);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
                else {
                    this.logger.error(`Failed to connect to database after ${retryAttempts} attempts. Exiting...`);
                    process.exit(1);
                }
            }
        }
    }
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = DatabaseModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            nestjs_kysely_1.KyselyModule.forRootAsync({
                imports: [],
                inject: [environment_service_1.EnvironmentService],
                useFactory: (environmentService) => ({
                    dialect: new kysely_postgres_js_1.PostgresJSDialect({
                        postgres: postgres((0, helpers_1.normalizePostgresUrl)(environmentService.getDatabaseURL()), {
                            max: environmentService.getDatabaseMaxPool(),
                            onnotice: () => { },
                            types: {
                                bigint: {
                                    to: 20,
                                    from: [20, 1700],
                                    serialize: (value) => value.toString(),
                                    parse: (value) => Number.parseInt(value),
                                },
                            },
                        }),
                    }),
                    plugins: [new kysely_1.CamelCasePlugin()],
                    log: (event) => {
                        if (environmentService.getNodeEnv() !== 'development')
                            return;
                        const logger = new common_1.Logger(DatabaseModule.name);
                        if (process.env.DEBUG_DB?.toLowerCase() === 'true') {
                            logger.debug(event.query.sql);
                            logger.debug('query time: ' + event.queryDurationMillis + ' ms');
                        }
                    },
                }),
            }),
        ],
        providers: [
            migration_service_1.MigrationService,
            workspace_repo_1.WorkspaceRepo,
            user_repo_1.UserRepo,
            group_repo_1.GroupRepo,
            group_user_repo_1.GroupUserRepo,
            space_repo_1.SpaceRepo,
            space_member_repo_1.SpaceMemberRepo,
            page_repo_1.PageRepo,
            page_permission_repo_1.PagePermissionRepo,
            page_transclusions_repo_1.PageTransclusionsRepo,
            page_transclusion_references_repo_1.PageTransclusionReferencesRepo,
            page_history_repo_1.PageHistoryRepo,
            comment_repo_1.CommentRepo,
            favorite_repo_1.FavoriteRepo,
            attachment_repo_1.AttachmentRepo,
            user_token_repo_1.UserTokenRepo,
            user_session_repo_1.UserSessionRepo,
            backlink_repo_1.BacklinkRepo,
            share_repo_1.ShareRepo,
            notification_repo_1.NotificationRepo,
            watcher_repo_1.WatcherRepo,
            label_repo_1.LabelRepo,
            template_repo_1.TemplateRepo,
            page_listener_1.PageListener,
        ],
        exports: [
            workspace_repo_1.WorkspaceRepo,
            user_repo_1.UserRepo,
            group_repo_1.GroupRepo,
            group_user_repo_1.GroupUserRepo,
            space_repo_1.SpaceRepo,
            space_member_repo_1.SpaceMemberRepo,
            page_repo_1.PageRepo,
            page_permission_repo_1.PagePermissionRepo,
            page_transclusions_repo_1.PageTransclusionsRepo,
            page_transclusion_references_repo_1.PageTransclusionReferencesRepo,
            page_history_repo_1.PageHistoryRepo,
            comment_repo_1.CommentRepo,
            favorite_repo_1.FavoriteRepo,
            attachment_repo_1.AttachmentRepo,
            user_token_repo_1.UserTokenRepo,
            user_session_repo_1.UserSessionRepo,
            backlink_repo_1.BacklinkRepo,
            share_repo_1.ShareRepo,
            notification_repo_1.NotificationRepo,
            watcher_repo_1.WatcherRepo,
            label_repo_1.LabelRepo,
            template_repo_1.TemplateRepo,
        ],
    }),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, migration_service_1.MigrationService,
        environment_service_1.EnvironmentService])
], DatabaseModule);
//# sourceMappingURL=database.module.js.map