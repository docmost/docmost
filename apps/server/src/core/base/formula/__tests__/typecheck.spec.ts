// TODO: unskip after Task 15 lands date functions and populates the registry.
import { parseRaw, resolve, typecheck, registry } from "@docmost/base-formula/server";
import type { FormulaAST } from "@docmost/base-formula/server";

const mk = (src: string, propTypes: Record<string, "number" | "string" | "boolean" | "date">) => {
  const names = new Map(Object.keys(propTypes).map((n) => [n, `prop_${n.toLowerCase()}`]));
  const resolved = resolve(parseRaw(src), names);
  const typeMap = new Map(Object.entries(propTypes).map(([n, t]) => [`prop_${n.toLowerCase()}`, t]));
  return { ast: resolved.ast, typeMap };
};

describe.skip("typecheck", () => {
  it("infers number for arithmetic", () => {
    const { ast, typeMap } = mk('prop("Price") * 2', { Price: "number" });
    expect(typecheck(ast, typeMap, registry).resultType).toBe("number");
  });
  it("rejects string * number", () => {
    const { ast, typeMap } = mk('prop("Name") * 2', { Name: "string" });
    expect(() => typecheck(ast, typeMap, registry)).toThrow(/TYPE_MISMATCH/);
  });
  it("infers boolean for comparison", () => {
    const { ast, typeMap } = mk('prop("Price") > 0', { Price: "number" });
    expect(typecheck(ast, typeMap, registry).resultType).toBe("boolean");
  });
  it("infers string for concat()", () => {
    const { ast, typeMap } = mk('concat(prop("Name"), "!")', { Name: "string" });
    expect(typecheck(ast, typeMap, registry).resultType).toBe("string");
  });
  it("infers branch-join type for if()", () => {
    const { ast, typeMap } = mk('if(true, prop("Price"), 0)', { Price: "number" });
    expect(typecheck(ast, typeMap, registry).resultType).toBe("number");
  });
});
