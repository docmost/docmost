import * as TurndownService from '@joplin/turndown';
import * as TurndownPluginGfm from '@joplin/turndown-plugin-gfm';
import * as path from 'path';

export function turndown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
    bulletListMarker: '-',
  });
  const tables = TurndownPluginGfm.tables;
  const strikethrough = TurndownPluginGfm.strikethrough;
  const highlightedCodeBlock = TurndownPluginGfm.highlightedCodeBlock;

  turndownService.use([
    tables,
    strikethrough,
    highlightedCodeBlock,
    taskList,
    callout,
    columnContainer,
    column,
    preserveDetail,
    listParagraph,
    mathInline,
    mathBlock,
    iframeEmbed,
    video,
  ]);
  return turndownService.turndown(html).replaceAll('<br>', ' ');
}

function listParagraph(turndownService: TurndownService) {
  turndownService.addRule('paragraph', {
    filter: ['p'],
    replacement: (content: any, node: HTMLInputElement) => {
      if (node.parentElement?.nodeName === 'LI') {
        return content;
      }

      return `\n\n${content}\n\n`;
    },
  });
}

function callout(turndownService: TurndownService) {
  turndownService.addRule('callout', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' && node.getAttribute('data-type') === 'callout'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const calloutType = node.getAttribute('data-callout-type');
      return `\n\n:::${calloutType}\n${content.trim()}\n:::\n\n`;
    },
  });
}

function columnContainer(turndownService: TurndownService) {
  turndownService.addRule('columnContainer', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' && node.getAttribute('data-type') === 'columnContainer'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      return `\n\n+++ columnContainer +++\n${content.trim()}\n+++ end:columnContainer +++\n\n`;
    },
  });
}

function column(turndownService: TurndownService) {
  turndownService.addRule('column', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' && node.getAttribute('data-type') === 'column'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const colXs = node.getAttribute('data-col-xs');
      const colMd = node.getAttribute('data-col-md');
      const colLg = node.getAttribute('data-col-lg');
      return `\n\n+++ column xs:${colXs} md:${colMd} lg:${colLg} +++\n${content.trim()}\n+++ end:column +++\n\n`;
    },
  });
}

function taskList(turndownService: TurndownService) {
  turndownService.addRule('taskListItem', {
    filter: function (node: HTMLInputElement) {
      return (
        node.getAttribute('data-type') === 'taskItem' &&
        node.parentNode.nodeName === 'UL'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const checkbox = node.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      const isChecked = checkbox.checked;

      return `- ${isChecked ? '[x]' : '[ ]'} ${content.trim()} \n`;
    },
  });
}

function preserveDetail(turndownService: TurndownService) {
  turndownService.addRule('preserveDetail', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'DETAILS';
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const summary = node.querySelector(':scope > summary');
      let detailSummary = '';

      if (summary) {
        detailSummary = `<summary>${turndownService.turndown(summary.innerHTML)}</summary>`;
      }

      const detailsContent = Array.from(node.childNodes)
        .filter((child) => child.nodeName !== 'SUMMARY')
        .map((child) =>
          child.nodeType === 1
            ? turndownService.turndown((child as HTMLElement).outerHTML)
            : child.textContent,
        )
        .join('');

      return `\n<details>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
    },
  });
}

function mathInline(turndownService: TurndownService) {
  turndownService.addRule('mathInline', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'SPAN' &&
        node.getAttribute('data-type') === 'mathInline'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      return `$${content}$`;
    },
  });
}

function mathBlock(turndownService: TurndownService) {
  turndownService.addRule('mathBlock', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'DIV' &&
        node.getAttribute('data-type') === 'mathBlock'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      return `\n$$\n${content}\n$$\n`;
    },
  });
}

function iframeEmbed(turndownService: TurndownService) {
  turndownService.addRule('iframeEmbed', {
    filter: function (node: HTMLInputElement) {
      return node.nodeName === 'IFRAME';
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const src = node.getAttribute('src');
      return '[' + src + '](' + src + ')';
    },
  });
}

function video(turndownService: TurndownService) {
  turndownService.addRule('video', {
    filter: function (node: HTMLInputElement) {
      return node.tagName === 'VIDEO';
    },
    replacement: function (content: any, node: HTMLInputElement) {
      const src = node.getAttribute('src') || '';
      const name = path.basename(src);
      return '[' + name + '](' + src + ')';
    },
  });
}
