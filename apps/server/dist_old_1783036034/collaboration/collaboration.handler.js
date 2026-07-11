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
var CollaborationHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationHandler = void 0;
const common_1 = require("@nestjs/common");
const transformer_1 = require("@hocuspocus/transformer");
const collaboration_util_1 = require("./collaboration.util");
const yjs_util_1 = require("./yjs.util");
const Y = require("yjs");
let CollaborationHandler = CollaborationHandler_1 = class CollaborationHandler {
    constructor() {
        this.logger = new common_1.Logger(CollaborationHandler_1.name);
    }
    getHandlers(hocuspocus) {
        return {
            alterState: async (documentName, payload) => {
            },
            setCommentMark: async (documentName, payload) => {
                const { yjsSelection, commentId, resolved, user } = payload;
                await this.withYdocConnection(hocuspocus, documentName, { user }, (doc) => {
                    const fragment = doc.getXmlFragment('default');
                    (0, yjs_util_1.setYjsMark)(doc, fragment, yjsSelection, 'comment', {
                        commentId,
                        resolved,
                    });
                });
            },
            resolveCommentMark: async (documentName, payload) => {
                const { commentId, resolved, user } = payload;
                await this.withYdocConnection(hocuspocus, documentName, { user }, (doc) => {
                    const fragment = doc.getXmlFragment('default');
                    (0, yjs_util_1.updateYjsMarkAttribute)(fragment, 'comment', { name: 'commentId', value: commentId }, { resolved });
                });
            },
            updatePageContent: async (documentName, payload) => {
                const { prosemirrorJson, operation, user } = payload;
                this.logger.debug('Updating page content via yjs', documentName);
                await this.withYdocConnection(hocuspocus, documentName, { user }, (doc) => {
                    const fragment = doc.getXmlFragment('default');
                    if (operation === 'replace') {
                        if (fragment.length > 0) {
                            fragment.delete(0, fragment.length);
                        }
                        const newDoc = transformer_1.TiptapTransformer.toYdoc(prosemirrorJson, 'default', collaboration_util_1.tiptapExtensions);
                        Y.applyUpdate(doc, Y.encodeStateAsUpdate(newDoc));
                    }
                    else {
                        const newContent = prosemirrorJson.content || [];
                        const yElements = newContent.map(collaboration_util_1.prosemirrorNodeToYElement);
                        const position = operation === 'prepend' ? 0 : fragment.length;
                        fragment.insert(position, yElements);
                    }
                });
            },
        };
    }
    async withYdocConnection(hocuspocus, documentName, context = {}, fn) {
        const connection = await hocuspocus.openDirectConnection(documentName, context);
        try {
            await connection.transact(fn);
        }
        finally {
            await connection.disconnect();
        }
    }
};
exports.CollaborationHandler = CollaborationHandler;
exports.CollaborationHandler = CollaborationHandler = CollaborationHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CollaborationHandler);
//# sourceMappingURL=collaboration.handler.js.map