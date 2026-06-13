import { tokenize, Token, TokenKind } from "./tokenizer";
import { FormulaParseError } from "./error";
import { MAX_PARSE_DEPTH } from "./types";
import type { OpCode } from "./ast";
import type { RawFormulaAST } from "./ast";

/*
 * Pratt parser. Top-level entry parses a full expression and then asserts EOF.
 * Binary operators are dispatched through a precedence table in `bp` below.
 * `prop(...)`, `if(...)`, `and(...)`, `or(...)` are intercepted when an
 * identifier is followed by `(` so they become their dedicated AST nodes.
 */
export function parseRaw(src: string): RawFormulaAST {
  const tokens = tokenize(src);
  const p = new Parser(tokens);
  const expr = p.parseExpr(0);
  p.expect(TokenKind.EOF, "Expected end of input");
  return expr;
}

const BP: Partial<Record<TokenKind, number>> = {
  [TokenKind.OR]: 10,
  [TokenKind.AND]: 20,
  [TokenKind.EQ]: 30, [TokenKind.NEQ]: 30,
  [TokenKind.LT]: 40, [TokenKind.GT]: 40,
  [TokenKind.LTE]: 40, [TokenKind.GTE]: 40,
  [TokenKind.PLUS]: 50, [TokenKind.MINUS]: 50,
  [TokenKind.STAR]: 60, [TokenKind.SLASH]: 60, [TokenKind.PERCENT]: 60,
};

const TOK_TO_OP: Partial<Record<TokenKind, OpCode>> = {
  [TokenKind.PLUS]: "+", [TokenKind.MINUS]: "-",
  [TokenKind.STAR]: "*", [TokenKind.SLASH]: "/", [TokenKind.PERCENT]: "%",
  [TokenKind.EQ]: "==", [TokenKind.NEQ]: "!=",
  [TokenKind.LT]: "<", [TokenKind.GT]: ">",
  [TokenKind.LTE]: "<=", [TokenKind.GTE]: ">=",
};

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token { return this.tokens[this.i]; }
  next(): Token { return this.tokens[this.i++]; }
  expect(kind: TokenKind, msg: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new FormulaParseError([{
        code: "UNEXPECTED_TOKEN", message: msg, span: { start: t.start, end: t.end },
      }]);
    }
    return this.next();
  }

  // Bound recursive descent. Every path that recurses (parens, unary chains,
  // binary rhs, call args) funnels through parseExpr/parseUnary, so guarding
  // their entry caps the JS stack and turns pathological nesting into a
  // catchable FormulaParseError instead of a RangeError.
  private enter(): void {
    if (++this.depth > MAX_PARSE_DEPTH) {
      const t = this.peek();
      throw new FormulaParseError([{
        code: "DEPTH_EXCEEDED",
        message: `Formula nesting too deep (max ${MAX_PARSE_DEPTH})`,
        span: { start: t.start, end: t.end },
      }]);
    }
  }

  parseExpr(minBp: number): RawFormulaAST {
    this.enter();
    try {
      return this.parseExprInner(minBp);
    } finally {
      this.depth--;
    }
  }

  private parseExprInner(minBp: number): RawFormulaAST {
    let lhs = this.parseUnary();

    while (true) {
      const tok = this.peek();
      if (tok.kind === TokenKind.AND) {
        if (BP[TokenKind.AND]! < minBp) break;
        this.next();
        const rhs = this.parseExpr(BP[TokenKind.AND]! + 1);
        lhs = { t: "and", args: [lhs, rhs] };
        continue;
      }
      if (tok.kind === TokenKind.OR) {
        if (BP[TokenKind.OR]! < minBp) break;
        this.next();
        const rhs = this.parseExpr(BP[TokenKind.OR]! + 1);
        lhs = { t: "or", args: [lhs, rhs] };
        continue;
      }
      const bp = BP[tok.kind];
      if (bp == null || bp < minBp) break;
      this.next();
      const rhs = this.parseExpr(bp + 1);
      const op = TOK_TO_OP[tok.kind]!;
      lhs = { t: "op", op, args: [lhs, rhs] };
    }
    return lhs;
  }

  parseUnary(): RawFormulaAST {
    const tok = this.peek();
    if (tok.kind === TokenKind.MINUS) {
      this.next();
      this.enter();
      try {
        return { t: "op", op: "neg", args: [this.parseUnary()] };
      } finally {
        this.depth--;
      }
    }
    if (tok.kind === TokenKind.NOT) {
      this.next();
      this.enter();
      try {
        return { t: "op", op: "not", args: [this.parseUnary()] };
      } finally {
        this.depth--;
      }
    }
    return this.parsePrimary();
  }

  parsePrimary(): RawFormulaAST {
    const tok = this.next();
    switch (tok.kind) {
      case TokenKind.NUMBER: return { t: "num", v: Number(tok.text) };
      case TokenKind.STRING: return { t: "str", v: tok.text };
      case TokenKind.TRUE:   return { t: "bool", v: true };
      case TokenKind.FALSE:  return { t: "bool", v: false };
      case TokenKind.NULL:   return { t: "null" };
      case TokenKind.LPAREN: {
        const e = this.parseExpr(0);
        this.expect(TokenKind.RPAREN, "Expected ')'");
        return e;
      }
      case TokenKind.AND:
      case TokenKind.OR:
      case TokenKind.IDENT: {
        if (this.peek().kind !== TokenKind.LPAREN) {
          throw new FormulaParseError([{
            code: "UNEXPECTED_TOKEN",
            message: `Unexpected identifier '${tok.text}' (did you mean prop("${tok.text}")?)`,
            span: { start: tok.start, end: tok.end },
          }]);
        }
        this.next(); // LPAREN
        const args: RawFormulaAST[] = [];
        if (this.peek().kind !== TokenKind.RPAREN) {
          args.push(this.parseExpr(0));
          while (this.peek().kind === TokenKind.COMMA) {
            this.next();
            args.push(this.parseExpr(0));
          }
        }
        this.expect(TokenKind.RPAREN, "Expected ')'");

        // Match special-form/keyword names case-insensitively; the `call`
        // node below keeps the raw casing the user typed.
        const head = tok.text.toLowerCase();
        if (head === "prop") {
          if (args.length !== 1 || args[0].t !== "str") {
            throw new FormulaParseError([{
              code: "UNEXPECTED_TOKEN",
              message: 'prop() expects exactly one string literal argument',
              span: { start: tok.start, end: tok.end },
            }]);
          }
          return { t: "propName", name: args[0].v };
        }
        if (head === "if") {
          if (args.length !== 3) {
            throw new FormulaParseError([{
              code: "ARITY_MISMATCH",
              message: "if() expects exactly 3 arguments",
              span: { start: tok.start, end: tok.end },
            }]);
          }
          return { t: "if", cond: args[0], then: args[1], else: args[2] };
        }
        if (head === "and") return { t: "and", args };
        if (head === "or")  return { t: "or", args };
        return { t: "call", fn: tok.text, args };
      }
      default:
        throw new FormulaParseError([{
          code: "UNEXPECTED_TOKEN",
          message: `Unexpected token '${tok.text || tok.kind}'`,
          span: { start: tok.start, end: tok.end },
        }]);
    }
  }
}
