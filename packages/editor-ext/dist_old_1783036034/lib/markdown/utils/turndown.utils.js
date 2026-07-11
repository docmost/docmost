"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToMarkdown = htmlToMarkdown;
const _TurndownService = require("@joplin/turndown");
const TurndownPluginGfm = require("@joplin/turndown-plugin-gfm");
const basename_1 = require("./basename");
const TurndownService = _TurndownService.default || _TurndownService;
function sanitizeMdLinkText(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/([\[\]!])/g, '\\$1')
        .replace(/[\r\n]+/g, ' ');
}
function htmlToMarkdown(html) {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        hr: '---',
        bulletListMarker: '-',
    });
    turndownService.use([
        TurndownPluginGfm.tables,
        TurndownPluginGfm.strikethrough,
        TurndownPluginGfm.highlightedCodeBlock,
        taskList,
        callout,
        preserveDetail,
        listParagraph,
        orderedListItem,
        mathInline,
        mathBlock,
        iframeEmbed,
        image,
        video,
    ]);
    return turndownService.turndown(html).replaceAll('<br>', ' ');
}
function listParagraph(turndownService) {
    turndownService.addRule('paragraph', {
        filter: ['p'],
        replacement: (content, node) => {
            if (node.parentElement?.nodeName === 'LI') {
                return content;
            }
            return `\n\n${content}\n\n`;
        },
    });
}
function orderedListItem(turndownService) {
    turndownService.addRule('orderedListItem', {
        filter: function (node) {
            return node.nodeName === 'LI' && node.getAttribute('data-type') !== 'taskItem';
        },
        replacement: (content, node, options) => {
            const parent = node.parentNode;
            if (parent.nodeName !== 'OL' && parent.nodeName !== 'UL') {
                return content;
            }
            content = content
                .replace(/^\n+/, '')
                .replace(/\n+$/, '\n')
                .replace(/\n/gm, '\n  ');
            let prefix;
            if (parent.nodeName === 'OL') {
                const start = parseInt(parent.getAttribute('start') || '1', 10);
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = `${start + index}. `;
            }
            else {
                prefix = `${options.bulletListMarker} `;
            }
            return (prefix +
                content +
                (node.nextSibling && !/\n$/.test(content) ? '\n' : ''));
        },
    });
}
function callout(turndownService) {
    turndownService.addRule('callout', {
        filter: function (node) {
            return (node.nodeName === 'DIV' && node.getAttribute('data-type') === 'callout');
        },
        replacement: function (content, node) {
            const calloutType = node.getAttribute('data-callout-type');
            return `\n\n:::${calloutType}\n${content.trim()}\n:::\n\n`;
        },
    });
}
function taskList(turndownService) {
    turndownService.addRule('taskListItem', {
        filter: function (node) {
            return (node.getAttribute('data-type') === 'taskItem' &&
                node.parentNode.nodeName === 'UL');
        },
        replacement: function (_content, node) {
            const isChecked = node.getAttribute('data-checked') === 'true';
            const div = node.querySelector('div');
            const text = div ? div.textContent.trim() : node.textContent.trim();
            const prefix = `- ${isChecked ? '[x]' : '[ ]'} `;
            return (prefix +
                text +
                (node.nextSibling && !/\n$/.test(text) ? '\n' : ''));
        },
    });
}
function preserveDetail(turndownService) {
    turndownService.addRule('preserveDetail', {
        filter: function (node) {
            return node.nodeName === 'DETAILS';
        },
        replacement: function (_content, node) {
            const summary = node.querySelector(':scope > summary');
            let detailSummary = '';
            if (summary) {
                detailSummary = `<summary>${turndownService.turndown(summary.innerHTML)}</summary>`;
            }
            const detailsContent = Array.from(node.childNodes)
                .filter((child) => child.nodeName !== 'SUMMARY')
                .map((child) => child.nodeType === 1
                ? turndownService.turndown(child.outerHTML)
                : child.textContent)
                .join('');
            return `\n<details>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
        },
    });
}
function mathInline(turndownService) {
    turndownService.addRule('mathInline', {
        filter: function (node) {
            return (node.nodeName === 'SPAN' &&
                node.getAttribute('data-type') === 'mathInline');
        },
        replacement: function (content) {
            return `$${content}$`;
        },
    });
}
function mathBlock(turndownService) {
    turndownService.addRule('mathBlock', {
        filter: function (node) {
            return (node.nodeName === 'DIV' &&
                node.getAttribute('data-type') === 'mathBlock');
        },
        replacement: function (content) {
            return `\n$$\n${content}\n$$\n`;
        },
    });
}
function iframeEmbed(turndownService) {
    turndownService.addRule('iframeEmbed', {
        filter: function (node) {
            return node.nodeName === 'IFRAME';
        },
        replacement: function (_content, node) {
            const src = node.getAttribute('src');
            return '[' + src + '](' + src + ')';
        },
    });
}
function image(turndownService) {
    turndownService.addRule('image', {
        filter: 'img',
        replacement: function (_content, node) {
            const src = node.getAttribute('src') || '';
            if (!src)
                return '';
            const alt = sanitizeMdLinkText(node.getAttribute('alt') || '');
            const title = node.getAttribute('title') || '';
            const titlePart = title ? ' "' + title.replace(/"/g, '\\"') + '"' : '';
            return '![' + alt + '](' + src + titlePart + ')';
        },
    });
}
function video(turndownService) {
    turndownService.addRule('video', {
        filter: function (node) {
            return node.tagName === 'VIDEO';
        },
        replacement: function (_content, node) {
            const src = node.getAttribute('src') || '';
            const ariaLabel = node.getAttribute('aria-label');
            const name = sanitizeMdLinkText(ariaLabel || (0, basename_1.getBasename)(src) || src);
            return '[' + name + '](' + src + ')';
        },
    });
}
//# sourceMappingURL=turndown.utils.js.map