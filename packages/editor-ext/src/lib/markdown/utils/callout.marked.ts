import { Token, marked } from 'marked';
import { getValidCalloutType } from '../../callout/utils';

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

    if (match) {
      return {
        type: 'callout',
        calloutType: getValidCalloutType(match[1]),
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
