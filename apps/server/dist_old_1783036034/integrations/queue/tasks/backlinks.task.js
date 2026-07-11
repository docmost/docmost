"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBacklinks = processBacklinks;
const common_1 = require("@nestjs/common");
const utils_1 = require("../../../database/utils");
const logger = new common_1.Logger('BacklinksTask');
async function processBacklinks(db, backlinkRepo, data) {
    const { pageId, mentions, workspaceId, internalLinkSlugIds = [] } = data;
    await (0, utils_1.executeTx)(db, async (trx) => {
        const existingBacklinks = await trx
            .selectFrom('backlinks')
            .select('targetPageId')
            .where('sourcePageId', '=', pageId)
            .execute();
        const mentionTargetPageIds = mentions
            .filter((mention) => mention.entityId !== pageId)
            .map((mention) => mention.entityId);
        let resolvedLinkPageIds = [];
        if (internalLinkSlugIds.length > 0) {
            const resolvedPages = await trx
                .selectFrom('pages')
                .select('id')
                .where('slugId', 'in', internalLinkSlugIds)
                .where('workspaceId', '=', workspaceId)
                .execute();
            resolvedLinkPageIds = resolvedPages
                .map((p) => p.id)
                .filter((id) => id !== pageId);
        }
        const allTargetPageIds = [
            ...new Set([...mentionTargetPageIds, ...resolvedLinkPageIds]),
        ];
        if (existingBacklinks.length === 0 && allTargetPageIds.length === 0) {
            return;
        }
        const existingTargetPageIds = existingBacklinks.map((backlink) => backlink.targetPageId);
        let validTargetPages = [];
        if (allTargetPageIds.length > 0) {
            validTargetPages = await trx
                .selectFrom('pages')
                .select('id')
                .where('id', 'in', allTargetPageIds)
                .where('workspaceId', '=', workspaceId)
                .execute();
        }
        const validTargetPageIds = validTargetPages.map((page) => page.id);
        const backlinksToAdd = validTargetPageIds.filter((id) => !existingTargetPageIds.includes(id));
        const backlinksToRemove = existingTargetPageIds.filter((existingId) => !validTargetPageIds.includes(existingId));
        if (backlinksToAdd.length > 0) {
            const newBacklinks = backlinksToAdd.map((targetPageId) => ({
                sourcePageId: pageId,
                targetPageId: targetPageId,
                workspaceId: workspaceId,
            }));
            await backlinkRepo.insertBacklink(newBacklinks, trx);
            logger.debug(`Added ${newBacklinks.length} new backlinks to ${pageId}`);
        }
        if (backlinksToRemove.length > 0) {
            await db
                .deleteFrom('backlinks')
                .where('sourcePageId', '=', pageId)
                .where('targetPageId', 'in', backlinksToRemove)
                .execute();
            logger.debug(`Removed ${backlinksToRemove.length} outdated backlinks from ${pageId}.`);
        }
    });
}
//# sourceMappingURL=backlinks.task.js.map