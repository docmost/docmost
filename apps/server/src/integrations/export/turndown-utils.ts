import * as TurndownService from '@joplin/turndown';
import * as TurndownPluginGfm from '@joplin/turndown-plugin-gfm';

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
    toggleListTitle,
    toggleListBody,
    listParagraph,
    mathInline,
    mathBlock,
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

      return `- ${isChecked ? '[x]' : '[ ]'}  ${content.trim()} \n`;
    },
  });
}

function toggleListTitle(turndownService: TurndownService) {
  turndownService.addRule('toggleListTitle', {
    filter: function (node: HTMLInputElement) {
      return (
        node.nodeName === 'SUMMARY' && node.parentNode.nodeName === 'DETAILS'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      return '- ' + content;
    },
  });
}

function toggleListBody(turndownService: TurndownService) {
  turndownService.addRule('toggleListContent', {
    filter: function (node: HTMLInputElement) {
      return (
        node.getAttribute('data-type') === 'detailsContent' &&
        node.parentNode.nodeName === 'DETAILS'
      );
    },
    replacement: function (content: any, node: HTMLInputElement) {
      return `   ${content.replace(/\n/g, '\n    ')}  `;
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
      return `$$${content}$$`;
    },
  });
}
