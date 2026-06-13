import { FormulaParseError } from "./error";
import { MAX_FORMULA_SOURCE_LENGTH } from "./types";

export enum TokenKind {
  NUMBER = "NUMBER",
  STRING = "STRING",
  IDENT = "IDENT",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",
  EQ = "EQ",
  NEQ = "NEQ",
  LT = "LT",
  GT = "GT",
  LTE = "LTE",
  GTE = "GTE",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  COMMA = "COMMA",
  EOF = "EOF",
}

export type Token = {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
};

const KEYWORDS: Record<string, TokenKind> = {
  true: TokenKind.TRUE,
  false: TokenKind.FALSE,
  null: TokenKind.NULL,
  and: TokenKind.AND,
  or: TokenKind.OR,
  not: TokenKind.NOT,
};

export function tokenize(src: string): Token[] {
  if (src.length > MAX_FORMULA_SOURCE_LENGTH) {
    throw new FormulaParseError([{
      code: "INPUT_TOO_LONG",
      message: `Formula is too long (${src.length} chars; max ${MAX_FORMULA_SOURCE_LENGTH})`,
      span: { start: 0, end: MAX_FORMULA_SOURCE_LENGTH },
    }]);
  }
  const tokens: Token[] = [];
  let i = 0;

  const push = (kind: TokenKind, text: string, start: number, end: number) =>
    tokens.push({ kind, text, start, end });

  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }

    if (ch >= "0" && ch <= "9") {
      const start = i;
      while (i < src.length && src[i] >= "0" && src[i] <= "9") i++;
      if (src[i] === ".") {
        i++;
        while (i < src.length && src[i] >= "0" && src[i] <= "9") i++;
      }
      push(TokenKind.NUMBER, src.slice(start, i), start, i);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let body = "";
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") {
          if (i + 1 >= src.length) {
            throw new FormulaParseError([{
              code: "UNEXPECTED_EOF",
              message: "Unterminated escape in string",
              span: { start, end: i + 1 },
            }]);
          }
          const esc = src[i + 1];
          body += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
          i += 2;
        } else {
          body += src[i];
          i++;
        }
      }
      if (i >= src.length) {
        throw new FormulaParseError([{
          code: "UNEXPECTED_EOF",
          message: "Unterminated string literal",
          span: { start, end: src.length },
        }]);
      }
      i++;
      push(TokenKind.STRING, body, start, i);
      continue;
    }

    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = i;
      while (
        i < src.length &&
        (
          (src[i] >= "a" && src[i] <= "z") ||
          (src[i] >= "A" && src[i] <= "Z") ||
          (src[i] >= "0" && src[i] <= "9") ||
          src[i] === "_"
        )
      ) i++;
      const text = src.slice(start, i);
      // Keywords and function names are case-insensitive: match on the
      // lowercased text but keep `text` raw on the token so error messages
      // and `format()` preserve the user's casing.
      // hasOwnProperty guards against inherited Object.prototype names
      // (toString, valueOf, hasOwnProperty, …) matching the KEYWORDS lookup —
      // those are valid identifiers/function names (e.g. the toString() fn).
      const lower = text.toLowerCase();
      const kw = Object.prototype.hasOwnProperty.call(KEYWORDS, lower) ? KEYWORDS[lower] : undefined;
      push(kw ?? TokenKind.IDENT, text, start, i);
      continue;
    }

    const start = i;
    const two = src.slice(i, i + 2);
    if (two === "==") { push(TokenKind.EQ, two, start, i + 2); i += 2; continue; }
    if (two === "!=") { push(TokenKind.NEQ, two, start, i + 2); i += 2; continue; }
    if (two === "<=") { push(TokenKind.LTE, two, start, i + 2); i += 2; continue; }
    if (two === ">=") { push(TokenKind.GTE, two, start, i + 2); i += 2; continue; }

    const singleMap: Record<string, TokenKind> = {
      "+": TokenKind.PLUS, "-": TokenKind.MINUS, "*": TokenKind.STAR,
      "/": TokenKind.SLASH, "%": TokenKind.PERCENT,
      "<": TokenKind.LT, ">": TokenKind.GT,
      "(": TokenKind.LPAREN, ")": TokenKind.RPAREN, ",": TokenKind.COMMA,
    };
    if (singleMap[ch]) { push(singleMap[ch], ch, start, i + 1); i++; continue; }

    throw new FormulaParseError([{
      code: "UNEXPECTED_TOKEN",
      message: `Unexpected character '${ch}'`,
      span: { start: i, end: i + 1 },
    }]);
  }

  tokens.push({ kind: TokenKind.EOF, text: "", start: i, end: i });
  return tokens;
}
