// src/extensions/audio/audio-upload.ts
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
    insertTrailingNode,
    MediaUploadOptions,
    UploadFn,
} from "../media-utils";
import { IAttachment } from "../types";

const uploadKey = new PluginKey("audio-upload");

export const AudioUploadPlugin = ({
                                      placeholderClass,
                                  }: {
    placeholderClass: string;
}) =>
    new Plugin({
        key: uploadKey,
        state: {
            init() {
                return DecorationSet.empty;
            },
            apply(tr, set) {
                set = set.map(tr.mapping, tr.doc);

                const action = tr.getMeta(this);
                if (action?.add) {
                    const { id, pos, src } = action.add;

                    const placeholder = document.createElement("div");
                    placeholder.setAttribute("class", "audio-placeholder");

                    const audio = document.createElement("audio");
                    audio.setAttribute("class", placeholderClass);
                    audio.src = src;
                    audio.controls = true;
                    audio.style.width = "100%";
                    audio.style.maxWidth = "400px";

                    const loadingText = document.createElement("span");
                    loadingText.textContent = "Uploading audio...";

                    placeholder.appendChild(audio);
                    placeholder.appendChild(loadingText);

                    const deco = Decoration.widget(pos + 1, placeholder, {
                        id,
                    });
                    set = set.add(tr.doc, [deco]);
                } else if (action?.remove) {
                    set = set.remove(
                        set.find(
                            undefined,
                            undefined,
                            (spec) => spec.id == action.remove.id,
                        ),
                    );
                }
                return set;
            },
        },
        props: {
            decorations(state) {
                return this.getState(state);
            },
        },
    });

function findPlaceholder(state: EditorState, id: {}) {
    const decos = uploadKey.getState(state) as DecorationSet;
    const found = decos.find(undefined, undefined, (spec) => spec.id == id);
    return found.length ? found[0]?.from : null;
}

export const handleAudioUpload =
    ({ validateFn, onUpload }: MediaUploadOptions): UploadFn =>
        async (file, view, pos, pageId) => {
            const validated = validateFn?.(file);
            // @ts-ignore
            if (!validated) return;

            const id = {};

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const tr = view.state.tr;
                if (!tr.selection.empty) tr.deleteSelection();

                tr.setMeta(uploadKey, {
                    add: {
                        id,
                        pos,
                        src: reader.result,
                    },
                });

                insertTrailingNode(tr, pos, view);
                view.dispatch(tr);
            };
            reader.onerror = (error) => {
                console.error("Error reading audio file:", error);
        
                const transaction = view.state.tr
                    .delete(pos, pos)
                    .setMeta(uploadKey, { remove: { id } });
                view.dispatch(transaction);
            };

            await onUpload(file, pageId).then(
                (attachment: IAttachment) => {
                    const { schema } = view.state;

                    const currentPos = findPlaceholder(view.state, id);
                    if (currentPos == null) return;

                    if (!attachment) return;

                    const node = schema.nodes.audio?.create({
                        src: `/api/files/${attachment.id}/${attachment.fileName}`,
                        attachmentId: attachment.id,
                        title: attachment.fileName,
                        size: attachment.fileSize,
                    });

                    if (!node) return;

                    const transaction = view.state.tr
                        .replaceWith(currentPos, currentPos, node)
                        .setMeta(uploadKey, { remove: { id } });
                    view.dispatch(transaction);
                },
                () => {
                    const transaction = view.state.tr
                        .delete(pos, pos)
                        .setMeta(uploadKey, { remove: { id } });
                    view.dispatch(transaction);
                },
            );
        };