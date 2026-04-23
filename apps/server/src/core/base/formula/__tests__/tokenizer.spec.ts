import { tokenize, TokenKind } from "@docmost/base-formula/server";

describe("tokenize", () => {
  const kinds = (src: string) => tokenize(src).map((t) => t.kind);
  const texts = (src: string) => tokenize(src).map((t) => t.text);

  it("emits EOF for empty input", () => {
    expect(kinds("")).toEqual([TokenKind.EOF]);
  });

  it("tokenizes numbers", () => {
    expect(kinds("42")).toEqual([TokenKind.NUMBER, TokenKind.EOF]);
    expect(kinds("-4.5")).toEqual([
      TokenKind.MINUS, TokenKind.NUMBER, TokenKind.EOF,
    ]);
    expect(texts("123.45")).toEqual(["123.45", ""]);
  });

  it("tokenizes string literals with either quote style", () => {
    expect(kinds('"hi"')).toEqual([TokenKind.STRING, TokenKind.EOF]);
    expect(kinds("'hi'")).toEqual([TokenKind.STRING, TokenKind.EOF]);
    expect(texts('"a b c"')[0]).toBe("a b c");
  });

  it("handles escape sequences in strings", () => {
    expect(texts('"a\\"b"')[0]).toBe('a"b');
    expect(texts('"a\\\\b"')[0]).toBe("a\\b");
    expect(texts('"a\\nb"')[0]).toBe("a\nb");
  });

  it("tokenizes keywords and identifiers", () => {
    expect(kinds("true false null and or not")).toEqual([
      TokenKind.TRUE, TokenKind.FALSE, TokenKind.NULL,
      TokenKind.AND, TokenKind.OR, TokenKind.NOT, TokenKind.EOF,
    ]);
    expect(kinds("prop foo _bar")).toEqual([
      TokenKind.IDENT, TokenKind.IDENT, TokenKind.IDENT, TokenKind.EOF,
    ]);
  });

  it("tokenizes operators", () => {
    expect(kinds("+ - * / %")).toEqual([
      TokenKind.PLUS, TokenKind.MINUS, TokenKind.STAR,
      TokenKind.SLASH, TokenKind.PERCENT, TokenKind.EOF,
    ]);
    expect(kinds("== != < > <= >=")).toEqual([
      TokenKind.EQ, TokenKind.NEQ, TokenKind.LT, TokenKind.GT,
      TokenKind.LTE, TokenKind.GTE, TokenKind.EOF,
    ]);
  });

  it("tokenizes punctuation", () => {
    expect(kinds("(),")).toEqual([
      TokenKind.LPAREN, TokenKind.RPAREN, TokenKind.COMMA, TokenKind.EOF,
    ]);
  });

  it("records source spans", () => {
    const ts = tokenize("  42 ");
    expect(ts[0].start).toBe(2);
    expect(ts[0].end).toBe(4);
  });

  it("throws on unterminated string with useful span", () => {
    expect(() => tokenize('"hi')).toThrow(/UNEXPECTED_EOF|unterminated/i);
  });

  it("throws on unknown character", () => {
    expect(() => tokenize("2 @ 3")).toThrow(/UNEXPECTED_TOKEN|unexpected/i);
  });
});
