import { Token, marked } from 'marked';

interface ColumnToken {
  type: 'column';
  colXs: number;
  colMd: number;
  colLg: number;
  text: string;
  raw: string;
}

export const columnExtension = {
  name: 'column',
  level: 'block',
  start(src: string) {
    return src.match(/\+\+\+ column xs:(\d+) md:(\d+) lg:(\d+) \+\+\+/)?.index ?? -1;
  },
  tokenizer(src: string): ColumnToken | undefined {
    const rule = /^\+\+\+ column xs:(\d+) md:(\d+) lg:(\d+) \+\+\+\s+([\s\S]+?)\+\+\+ end:column \+\+\+/;
    const match = rule.exec(src);

    if (match) {
      let colXsMatch = parseInt(match[1]);
      let colMdMatch = parseInt(match[2]);
      let colLgMatch = parseInt(match[3]);

      if (colXsMatch<0 || colXsMatch>12) colXsMatch = 0;
      if (colMdMatch<0 || colMdMatch>12) colMdMatch = 0;
      if (colLgMatch<0 || colLgMatch>12) colLgMatch = 0;

      return {
        type: 'column',
        colXs: colXsMatch,
        colMd: colMdMatch,
        colLg: colLgMatch,
        raw: match[0],
        text: match[4].trim(),
      };
    }
  },
  renderer(token: Token) {
    const columnToken = token as ColumnToken;
    const body = marked.parse(columnToken.text);

    return `<div data-type="column" data-col-xs="${columnToken.colXs}" data-col-md="${columnToken.colMd}" data-col-lg="${columnToken.colLg}">${body}</div>`;
  },
};
