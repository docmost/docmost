"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiptapVideo = void 0;
const react_1 = require("@tiptap/react");
const core_1 = require("@tiptap/core");
const resizable_nodeview_1 = require("../resizable-nodeview");
const media_utils_1 = require("../media-utils");
exports.TiptapVideo = core_1.Node.create({
    name: "video",
    group: "block",
    isolating: true,
    atom: true,
    defining: true,
    draggable: true,
    addOptions() {
        return {
            view: null,
            HTMLAttributes: {},
            resize: false,
        };
    },
    addAttributes() {
        return {
            src: {
                default: "",
                parseHTML: (element) => element.getAttribute("src"),
                renderHTML: (attributes) => ({
                    src: attributes.src,
                }),
            },
            alt: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("aria-label"),
                renderHTML: (attributes) => ({
                    "aria-label": attributes.alt,
                }),
            },
            attachmentId: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-id"),
                renderHTML: (attributes) => ({
                    "data-attachment-id": attributes.attachmentId,
                }),
            },
            width: {
                default: null,
                parseHTML: (element) => {
                    const raw = element.getAttribute("width");
                    if (!raw)
                        return null;
                    if (raw.endsWith("%"))
                        return raw;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    width: attributes.width,
                }),
            },
            height: {
                default: null,
                parseHTML: (element) => {
                    const raw = element.getAttribute("height");
                    if (!raw)
                        return null;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    height: attributes.height,
                }),
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-size"),
                renderHTML: (attributes) => ({
                    "data-size": attributes.size,
                }),
            },
            align: {
                default: "center",
                parseHTML: (element) => element.getAttribute("data-align"),
                renderHTML: (attributes) => ({
                    "data-align": attributes.align,
                }),
            },
            aspectRatio: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-aspect-ratio"),
                renderHTML: (attributes) => ({
                    "data-aspect-ratio": attributes.aspectRatio,
                }),
            },
            placeholder: {
                default: null,
                rendered: false,
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: "video",
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "video",
            { controls: "true", ...HTMLAttributes },
            ["source", HTMLAttributes],
        ];
    },
    addCommands() {
        return {
            setVideo: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: "video",
                    attrs: attrs,
                });
            },
            setVideoAlign: (align) => ({ commands }) => commands.updateAttributes("video", { align }),
            setVideoWidth: (width) => ({ commands }) => commands.updateAttributes("video", {
                width: `${Math.max(0, Math.min(100, width))}%`,
            }),
            setVideoSize: (width, height) => ({ commands }) => commands.updateAttributes("video", { width, height }),
        };
    },
    addNodeView() {
        const resize = this.options.resize;
        if (!resize || !resize.enabled) {
            this.editor.isInitialized = true;
            return (0, react_1.ReactNodeViewRenderer)(this.options.view);
        }
        const { directions, minWidth, minHeight, alwaysPreserveAspectRatio, createCustomHandle, className, } = resize;
        return (props) => {
            const { node, getPos, HTMLAttributes, editor } = props;
            if (!node.attrs.src) {
                editor.isInitialized = true;
                const reactView = (0, react_1.ReactNodeViewRenderer)(this.options.view);
                const view = reactView(props);
                const originalUpdate = view.update?.bind(view);
                view.update = (updatedNode, decorations, innerDecorations) => {
                    if (updatedNode.attrs.src && !node.attrs.src) {
                        return false;
                    }
                    if (originalUpdate) {
                        return originalUpdate(updatedNode, decorations, innerDecorations);
                    }
                    return true;
                };
                return view;
            }
            const el = document.createElement("video");
            el.src = (0, media_utils_1.normalizeFileUrl)(node.attrs.src);
            el.controls = true;
            el.preload = "metadata";
            if (node.attrs.alt) {
                el.setAttribute("aria-label", node.attrs.alt);
            }
            el.style.display = "block";
            el.style.maxWidth = "100%";
            el.style.borderRadius = "8px";
            if (typeof node.attrs.width === "number" && node.attrs.width > 0) {
                el.style.width = `${node.attrs.width}px`;
                if (typeof node.attrs.height === "number" && node.attrs.height > 0) {
                    el.style.height = `${node.attrs.height}px`;
                }
            }
            let currentNode = node;
            const nodeView = new resizable_nodeview_1.ResizableNodeView({
                element: el,
                editor,
                node,
                getPos,
                onResize: (w, h) => {
                    el.style.width = `${w}px`;
                    el.style.height = `${h}px`;
                },
                onCommit: () => {
                    const pos = getPos();
                    if (pos === undefined)
                        return;
                    this.editor
                        .chain()
                        .setNodeSelection(pos)
                        .updateAttributes(this.name, {
                        width: Math.round(el.offsetWidth),
                        height: Math.round(el.offsetHeight),
                    })
                        .run();
                },
                onUpdate: (updatedNode, _decorations, _innerDecorations) => {
                    if (updatedNode.type !== currentNode.type) {
                        return false;
                    }
                    if (updatedNode.attrs.src !== currentNode.attrs.src) {
                        el.src = (0, media_utils_1.normalizeFileUrl)(updatedNode.attrs.src);
                    }
                    if (updatedNode.attrs.alt !== currentNode.attrs.alt) {
                        if (updatedNode.attrs.alt) {
                            el.setAttribute("aria-label", updatedNode.attrs.alt);
                        }
                        else {
                            el.removeAttribute("aria-label");
                        }
                    }
                    const w = updatedNode.attrs.width;
                    const h = updatedNode.attrs.height;
                    if (w != null) {
                        el.style.width = `${w}px`;
                    }
                    if (h != null) {
                        el.style.height = `${h}px`;
                    }
                    const align = updatedNode.attrs.align || "center";
                    const container = nodeView.dom;
                    applyAlignment(container, align);
                    currentNode = updatedNode;
                    return true;
                },
                options: {
                    directions,
                    min: {
                        width: minWidth,
                        height: minHeight,
                    },
                    preserveAspectRatio: alwaysPreserveAspectRatio === true,
                    createCustomHandle,
                    className,
                },
            });
            const dom = nodeView.dom;
            applyAlignment(dom, node.attrs.align || "center");
            const widthAttr = node.attrs.width;
            if (typeof widthAttr === "string" && widthAttr.endsWith("%")) {
                requestAnimationFrame(() => {
                    const parentEl = dom.parentElement;
                    if (parentEl) {
                        const containerWidth = parentEl.clientWidth;
                        const pctValue = parseInt(widthAttr, 10);
                        if (!isNaN(pctValue) && containerWidth > 0) {
                            const pxWidth = Math.round(containerWidth * (pctValue / 100));
                            el.style.width = `${pxWidth}px`;
                            if (node.attrs.aspectRatio) {
                                el.style.height = `${Math.round(pxWidth / node.attrs.aspectRatio)}px`;
                            }
                        }
                    }
                    dom.style.visibility = "";
                    dom.style.pointerEvents = "";
                });
            }
            dom.style.pointerEvents = "none";
            el.classList.add("media-pulse");
            el.onloadedmetadata = () => {
                dom.style.pointerEvents = "";
                el.classList.remove("media-pulse");
            };
            return nodeView;
        };
    },
});
function applyAlignment(container, align) {
    if (align === "left") {
        container.style.justifyContent = "flex-start";
    }
    else if (align === "right") {
        container.style.justifyContent = "flex-end";
    }
    else {
        container.style.justifyContent = "center";
    }
}
//# sourceMappingURL=video.js.map