import { Token, marked } from 'marked';

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
    // parse to prevent escaping slashes
    const latex = marked
      .parse(mathBlockToken.text)
      .toString()
      .replace(/<(\/)?p>/g, '');

    return `<div data-type="${mathBlockToken.type}" data-katex="true">${latex}</div>`;
  },
};
