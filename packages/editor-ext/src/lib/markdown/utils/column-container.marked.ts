import { Token, marked } from 'marked';

interface ColumnContainerToken {
  type: 'columnContainer';
  text: string;
  raw: string;
}

export const columnContainerExtension = {
  name: 'columnContainer',
  level: 'block',
  start(src: string) {
    return src.match(/\+\+\+ columnContainer \+\+\+/)?.index ?? -1;
  },
  tokenizer(src: string): ColumnContainerToken | undefined {
    const rule = /^\+\+\+ columnContainer \+\+\+\s+([\s\S]+?)\+\+\+ end:columnContainer \+\+\+/;
    const match = rule.exec(src);

    if (match) {
      return {
        type: 'columnContainer',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token: Token) {
    const columnContainerToken = token as ColumnContainerToken;
    const body = marked.parse(columnContainerToken.text);

    return `<div data-type="columnContainer">${body}</div>`;
  },
};
