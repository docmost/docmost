import { Token } from 'marked';
import { escapeHtml } from './escape-html';

interface MathBlockToken {
  type: 'mathBlock';
  text: string;
  raw: string;
}

export const mathBlockExtension = {
  name: 'mathBlock',
  level: 'block',
  start(src: string) {
    return src.match(/\$\$/)?.index ?? -1;
  },
  tokenizer(src: string): MathBlockToken | undefined {
    const rule = /^\$\$(?!(\$))([\s\S]+?)\$\$/;
    const match = rule.exec(src);

    if (match) {
      return {
        type: 'mathBlock',
        raw: match[0],
        text: match[2]?.trim(),
      };
    }
  },
  renderer(token: Token) {
    const mathBlockToken = token as MathBlockToken;
    // LaTeX is raw text: never run it through the markdown parser, which
    // would unescape `\*`, turn `_x_` into emphasis and append newlines.
    const latex = escapeHtml(mathBlockToken.text);

    return `<div data-type="${mathBlockToken.type}" data-katex="true">${latex}</div>`;
  },
};
