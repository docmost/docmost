import { BaseFormulaGraph } from "@docmost/base-formula/server";

type Prop = { id: string; type: string; typeOptions: any };

const mk = (defs: Array<[string, string[]] | [string]>): Prop[] =>
  defs.map(([id, deps]) => ({
    id,
    type: deps ? "formula" : "number",
    typeOptions: deps ? { dependencies: deps } : {},
  }));

describe("BaseFormulaGraph", () => {
  it("returns dependents", () => {
    const g = new BaseFormulaGraph(mk([
      ["A"], ["B"], ["C", ["A", "B"]],
    ]));
    expect(g.dependents("A").sort()).toEqual(["C"]);
    expect(g.dependents("B").sort()).toEqual(["C"]);
    expect(g.dependents("X")).toEqual([]);
  });

  it("produces a topological order", () => {
    const g = new BaseFormulaGraph(mk([
      ["A"], ["B", ["A"]], ["C", ["B"]],
    ]));
    const order = g.evalOrder();
    expect(order.indexOf("B")).toBeLessThan(order.indexOf("C"));
  });

  it("computes transitive affected formulas", () => {
    const g = new BaseFormulaGraph(mk([
      ["A"], ["B", ["A"]], ["C", ["B"]], ["D", ["A"]],
    ]));
    expect(g.affectedFormulas(["A"]).sort()).toEqual(["B", "C", "D"]);
  });

  it("detects a direct cycle", () => {
    const props = mk([["A", ["B"]], ["B", ["A"]]]);
    const g = new BaseFormulaGraph(props);
    expect(g.detectCycle(props[0])).not.toBeNull();
  });

  it("detects a transitive cycle", () => {
    const props = mk([["A", ["B"]], ["B", ["C"]], ["C", ["A"]]]);
    const g = new BaseFormulaGraph(props);
    expect(g.detectCycle(props[0])).not.toBeNull();
  });

  it("returns null when there is no cycle", () => {
    const props = mk([["A"], ["B", ["A"]]]);
    const g = new BaseFormulaGraph(props);
    expect(g.detectCycle(props[1])).toBeNull();
  });
});
