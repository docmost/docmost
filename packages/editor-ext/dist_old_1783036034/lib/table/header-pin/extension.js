"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableHeaderPin = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const controller_1 = require("./controller");
const tableHeaderPinKey = new state_1.PluginKey('tableHeaderPin');
exports.TableHeaderPin = core_1.Extension.create({
    name: 'tableHeaderPin',
    addProseMirrorPlugins() {
        let editorRoot = null;
        let domObserver = null;
        const tracked = new Set();
        let rafHandle = null;
        const reconcile = () => {
            rafHandle = null;
            if (!editorRoot)
                return;
            const current = new Set(editorRoot.querySelectorAll('.tableWrapper'));
            for (const w of tracked) {
                if (!current.has(w)) {
                    (0, controller_1.detach)(w);
                    tracked.delete(w);
                }
            }
            for (const w of current) {
                if (!tracked.has(w)) {
                    (0, controller_1.attach)(w);
                    tracked.add(w);
                }
            }
        };
        const schedule = () => {
            if (rafHandle !== null)
                return;
            rafHandle = requestAnimationFrame(reconcile);
        };
        return [
            new state_1.Plugin({
                key: tableHeaderPinKey,
                view(editorView) {
                    editorRoot = editorView.dom;
                    schedule();
                    domObserver = new MutationObserver(schedule);
                    domObserver.observe(editorRoot, { subtree: true, childList: true });
                    return {
                        update(view, prevState) {
                            if (!editorRoot)
                                return;
                            if (view.state.doc === prevState.doc)
                                return;
                            editorRoot
                                .querySelectorAll('.tableWrapper')
                                .forEach((w) => (0, controller_1.getController)(w)?.refresh());
                        },
                        destroy() {
                            if (rafHandle !== null) {
                                cancelAnimationFrame(rafHandle);
                                rafHandle = null;
                            }
                            domObserver?.disconnect();
                            domObserver = null;
                            for (const w of tracked)
                                (0, controller_1.detach)(w);
                            tracked.clear();
                            editorRoot = null;
                        },
                    };
                },
            }),
        ];
    },
});
//# sourceMappingURL=extension.js.map