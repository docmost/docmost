import { describe, expect, it } from "vitest";
import { guessStatusCategory, previewChoiceColors } from "./csv-import-choices";

describe("guessStatusCategory", () => {
  it("maps common status names to categories", () => {
    expect(guessStatusCategory(" Done ")).toBe("complete");
    expect(guessStatusCategory("In review")).toBe("inProgress");
    expect(guessStatusCategory("in_progress")).toBe("inProgress");
    expect(guessStatusCategory("Won't do")).toBe("complete");
    expect(guessStatusCategory("Backlog")).toBe("todo");
  });
});

describe("previewChoiceColors", () => {
  it("keeps existing colors and continues the palette for new names", () => {
    const colors = previewChoiceColors(
      "select",
      [{ id: "opt000000001", name: "High", color: "red" }],
      ["high", "Low", "Medium", "low"],
    );
    expect(colors.get("high")).toBe("red");
    expect(colors.get("low")).toBe("red");
    expect(colors.get("medium")).toBe("pink");
  });

  it("takes the first of two existing names that differ only by case", () => {
    const colors = previewChoiceColors(
      "select",
      [
        { id: "opt000000001", name: "High", color: "red" },
        { id: "opt000000002", name: "high", color: "blue" },
      ],
      ["HIGH"],
    );
    expect(colors.get("high")).toBe("red");
  });

  it("colors new status choices by category", () => {
    const colors = previewChoiceColors("status", [], ["Done", "Doing", "Todo"]);
    expect(colors.get("done")).toBe("green");
    expect(colors.get("doing")).toBe("blue");
    expect(colors.get("todo")).toBe("gray");
  });
});
