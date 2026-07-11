"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const environment_service_1 = require("../environment/environment.service");
const helpers_1 = require("../../common/helpers");
const constants_1 = require("./constants");
const general_queue_processor_1 = require("./processors/general-queue.processor");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                useFactory: (environmentService) => {
                    const redisConfig = (0, helpers_1.parseRedisUrl)(environmentService.getRedisUrl());
                    return {
                        connection: {
                            host: redisConfig.host,
                            port: redisConfig.port,
                            password: redisConfig.password,
                            db: redisConfig.db,
                            family: redisConfig.family,
                            retryStrategy: (0, helpers_1.createRetryStrategy)(),
                        },
                        defaultJobOptions: {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 20 * 1000,
                            },
                            removeOnComplete: {
                                count: 200,
                            },
                            removeOnFail: {
                                count: 100,
                            },
                        },
                    };
                },
                inject: [environment_service_1.EnvironmentService],
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.EMAIL_QUEUE,
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.ATTACHMENT_QUEUE,
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.GENERAL_QUEUE,
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.BILLING_QUEUE,
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.FILE_TASK_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: true,
                    attempts: 1,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.SEARCH_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: true,
                    attempts: 2,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.AI_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: true,
                    attempts: 1,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.HISTORY_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: true,
                    attempts: 2,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.NOTIFICATION_QUEUE,
            }),
            bullmq_1.BullModule.registerQueue({
                name: constants_1.QueueName.AUDIT_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: true,
                    attempts: 3,
                },
            }),
        ],
        exports: [bullmq_1.BullModule],
        providers: [general_queue_processor_1.GeneralQueueProcessor],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map