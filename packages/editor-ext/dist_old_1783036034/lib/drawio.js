"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Drawio = void 0;
const core_1 = require("@tiptap/core");
const resizable_nodeview_1 = require("./resizable-nodeview");
const react_1 = require("@tiptap/react");
const media_utils_1 = require("./media-utils");
exports.Drawio = core_1.Node.create({
    name: "drawio",
    inline: false,
    group: "block",
    isolating: true,
    atom: true,
    defining: true,
    draggable: true,
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
            resize: false,
        };
    },
    addAttributes() {
        return {
            src: {
                default: "",
                parseHTML: (element) => element.getAttribute("data-src"),
                renderHTML: (attributes) => ({
                    "data-src": attributes.src,
                }),
            },
            title: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-title"),
                renderHTML: (attributes) => ({
                    "data-title": attributes.title,
                }),
            },
            alt: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-alt"),
                renderHTML: (attributes) => ({
                    "data-alt": attributes.alt,
                }),
            },
            width: {
                default: null,
                parseHTML: (element) => {
                    const raw = element.getAttribute("data-width");
                    if (!raw)
                        return null;
                    if (raw.endsWith("%"))
                        return raw;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    "data-width": attributes.width,
                }),
            },
            height: {
                default: null,
                parseHTML: (element) => {
                    const raw = element.getAttribute("data-height");
                    if (!raw)
                        return null;
                    const num = parseFloat(raw);
                    return isNaN(num) ? null : num;
                },
                renderHTML: (attributes) => ({
                    "data-height": attributes.height,
                }),
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-size"),
                renderHTML: (attributes) => ({
                    "data-size": attributes.size,
                }),
            },
            aspectRatio: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-aspect-ratio"),
                renderHTML: (attributes) => ({
                    "data-aspect-ratio": attributes.aspectRatio,
                }),
            },
            align: {
                default: "center",
                parseHTML: (element) => element.getAttribute("data-align"),
                renderHTML: (attributes) => ({
                    "data-align": attributes.align,
                }),
            },
            attachmentId: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-id"),
                renderHTML: (attributes) => ({
                    "data-attachment-id": attributes.attachmentId,
                }),
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: `div[data-type="${this.name}"]`,
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            (0, core_1.mergeAttributes)({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
            [
                "img",
                {
                    src: HTMLAttributes["data-src"],
                    alt: HTMLAttributes["data-alt"] || HTMLAttributes["data-title"],
                    width: HTMLAttributes["data-width"],
                },
            ],
        ];
    },
    addCommands() {
        return {
            setDrawio: (attrs) => ({ commands }) => {
                return commands.insertContent({
                    type: "drawio",
                    attrs: attrs,
                });
            },
            setDrawioAlign: (align) => ({ commands }) => commands.updateAttributes("drawio", { align }),
            setDrawioSize: (width, height) => ({ commands }) => commands.updateAttributes("drawio", { width, height }),
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
            const el = document.createElement("img");
            el.src = (0, media_utils_1.normalizeFileUrl)(node.attrs.src);
            el.alt = node.attrs.alt || node.attrs.title || "";
            el.style.display = "block";
            el.style.maxWidth = "100%";
            el.style.borderRadius = "8px";
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
                    if (updatedNode.attrs.alt !== currentNode.attrs.alt ||
                        updatedNode.attrs.title !== currentNode.attrs.title) {
                        el.alt =
                            updatedNode.attrs.alt || updatedNode.attrs.title || "";
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
            el.onload = () => {
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
//# sourceMappingURL=drawio.js.map