import { FormulaService } from "../formula.service";
import type { BaseProperty } from "@docmost/db/types/entity.types";

const mkProp = (
  id: string, type: string, typeOptions: any = {},
  name = id,
): BaseProperty => ({
  id, baseId: "base_1", name, type: type as any, position: "a",
  typeOptions, isPrimary: false, workspaceId: "ws_1",
  createdAt: new Date(), updatedAt: new Date(),
  schemaVersion: 0, pendingType: null, pendingTypeOptions: null,
} as any);

describe("FormulaService.evaluateInline", () => {
  const svc = new FormulaService({ add: jest.fn() } as any);

  it("computes a formula on create", () => {
    const price  = mkProp("prop_price", "number", {}, "Price");
    const qty    = mkProp("prop_qty",   "number", {}, "Qty");
    const total = mkProp("prop_total", "formula", {
      source: 'prop("Price") * prop("Qty")',
      ast: { t: "op", op: "*", args: [
        { t: "prop", id: "prop_price" },
        { t: "prop", id: "prop_qty" },
      ]},
      resultType: "number",
      dependencies: ["prop_price", "prop_qty"],
      astVersion: 1,
    }, "Total");

    const patch = svc.evaluateInline({
      properties: [price, qty, total],
      row: { prop_price: 10, prop_qty: 3 },
      dirtyProps: ["prop_price", "prop_qty", "prop_total"],
    });
    expect(patch).toEqual({ prop_total: 30 });
  });

  it("returns empty patch when no formula is affected", () => {
    const price = mkProp("prop_price", "number", {}, "Price");
    expect(
      svc.evaluateInline({ properties: [price], row: { prop_price: 10 }, dirtyProps: ["prop_price"] }),
    ).toEqual({});
  });
});
