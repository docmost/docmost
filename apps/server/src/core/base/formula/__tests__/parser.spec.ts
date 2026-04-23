import { parseRaw } from "@docmost/base-formula/server";
import type { RawFormulaAST } from "@docmost/base-formula/server";

describe("parseRaw", () => {
  it("parses a number literal", () => {
    expect(parseRaw("42")).toEqual({ t: "num", v: 42 });
  });

  it("parses a string literal", () => {
    expect(parseRaw('"hi"')).toEqual({ t: "str", v: "hi" });
  });

  it("parses true/false/null", () => {
    expect(parseRaw("true")).toEqual({ t: "bool", v: true });
    expect(parseRaw("false")).toEqual({ t: "bool", v: false });
    expect(parseRaw("null")).toEqual({ t: "null" });
  });

  it("parses prop(\"Name\")", () => {
    expect(parseRaw('prop("Price")')).toEqual({ t: "propName", name: "Price" });
  });

  it("parses unary minus", () => {
    expect(parseRaw("-5")).toEqual({
      t: "op", op: "neg", args: [{ t: "num", v: 5 }],
    });
  });

  it("parses binary arithmetic with precedence", () => {
    expect(parseRaw("1 + 2 * 3")).toEqual({
      t: "op", op: "+", args: [
        { t: "num", v: 1 },
        { t: "op", op: "*", args: [{ t: "num", v: 2 }, { t: "num", v: 3 }] },
      ],
    });
  });

  it("respects parentheses", () => {
    expect(parseRaw("(1 + 2) * 3")).toEqual({
      t: "op", op: "*", args: [
        { t: "op", op: "+", args: [{ t: "num", v: 1 }, { t: "num", v: 2 }] },
        { t: "num", v: 3 },
      ],
    });
  });

  it("parses comparisons below arithmetic precedence", () => {
    const ast = parseRaw("1 + 2 == 3") as any;
    expect(ast.t).toBe("op");
    expect(ast.op).toBe("==");
  });

  it("parses and/or/not with correct precedence", () => {
    const ast = parseRaw('prop("A") or prop("B") and prop("C")') as any;
    expect(ast.t).toBe("or");
    expect(ast.args[1].t).toBe("and");
  });

  it("parses not as highest unary", () => {
    const ast = parseRaw('not prop("A")') as any;
    expect(ast.t).toBe("op");
    expect(ast.op).toBe("not");
  });

  it("parses function calls", () => {
    expect(parseRaw("round(1.5)")).toEqual({
      t: "call", fn: "round", args: [{ t: "num", v: 1.5 }],
    });
    expect(parseRaw("concat(\"a\", \"b\", \"c\")")).toEqual({
      t: "call", fn: "concat", args: [
        { t: "str", v: "a" }, { t: "str", v: "b" }, { t: "str", v: "c" },
      ],
    });
  });

  it("parses if/and/or as dedicated nodes", () => {
    const iff = parseRaw('if(true, 1, 2)') as any;
    expect(iff.t).toBe("if");
    expect(iff.cond).toEqual({ t: "bool", v: true });
    expect(iff.then).toEqual({ t: "num", v: 1 });
    expect(iff.else).toEqual({ t: "num", v: 2 });

    const an = parseRaw('and(true, false)') as any;
    expect(an.t).toBe("and");
    expect(an.args.length).toBe(2);
  });

  it("accepts nested calls", () => {
    const ast = parseRaw('round(concat("a", 1))') as any;
    expect(ast.t).toBe("call");
    expect(ast.args[0].t).toBe("call");
  });

  it("throws on empty input", () => {
    expect(() => parseRaw("")).toThrow();
  });

  it("throws on trailing garbage", () => {
    expect(() => parseRaw("1 2")).toThrow();
  });

  it("throws on unbalanced parens", () => {
    expect(() => parseRaw("(1 + 2")).toThrow();
  });

  it("throws when prop() is called without a string", () => {
    expect(() => parseRaw("prop(5)")).toThrow();
  });

  it("throws when prop() has wrong arity", () => {
    expect(() => parseRaw('prop("A", "B")')).toThrow();
    expect(() => parseRaw("prop()")).toThrow();
  });
});
