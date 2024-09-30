import { Token, marked } from 'marked';

interface CalloutToken {
  type: 'callout';
  calloutType: string;
  text: string;
  raw: string;
}

export const calloutExtension = {
  name: 'callout',
  level: 'block',
  start(src: string) {
    return src.match(/:::/)?.index ?? -1;
  },
  tokenizer(src: string): CalloutToken | undefined {
    const rule = /^:::([a-zA-Z0-9]+)\s+([\s\S]+?):::/;
    const match = rule.exec(src);

    const validCalloutTypes = ['info', 'success', 'warning', 'danger'];

    if (match) {
      let type = match[1];
      if (!validCalloutTypes.includes(type)) {
        type = 'info';
      }
      return {
        type: 'callout',
        calloutType: type,
        raw: match[0],
        text: match[2].trim(),
      };
    }
  },
  renderer(token: Token) {
    const calloutToken = token as CalloutToken;
    const body = marked.parse(calloutToken.text);

    return `<div data-type="callout" data-callout-type="${calloutToken.calloutType}">${body}</div>`;
  },
};
