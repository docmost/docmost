import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { changeIndent } from "./indent-utils";

function createEditor(activeNode: string | null) {
  const run = vi.fn(() => true);
  const chain = {
    focus: vi.fn(),
    indent: vi.fn(),
    liftListItem: vi.fn(),
    outdent: vi.fn(),
    run,
    sinkListItem: vi.fn(),
  };
  for (const method of ["focus", "indent", "liftListItem", "outdent", "sinkListItem"] as const) {
    chain[method].mockReturnValue(chain);
  }

  return {
    editor: {
      chain: vi.fn(() => chain),
      isActive: vi.fn((name: string) => name === activeNode),
    } as unknown as Editor,
    chain,
  };
}

describe("changeIndent", () => {
  it("uses list commands for list items", () => {
    const { editor, chain } = createEditor("listItem");

    changeIndent(editor, "indent");

    expect(chain.sinkListItem).toHaveBeenCalledWith("listItem");
    expect(chain.indent).not.toHaveBeenCalled();
  });

  it("uses list commands for task items", () => {
    const { editor, chain } = createEditor("taskItem");

    changeIndent(editor, "outdent");

    expect(chain.liftListItem).toHaveBeenCalledWith("taskItem");
    expect(chain.outdent).not.toHaveBeenCalled();
  });

  it("keeps the existing indentation commands for other blocks", () => {
    const { editor, chain } = createEditor(null);

    changeIndent(editor, "indent");

    expect(chain.indent).toHaveBeenCalledOnce();
    expect(chain.sinkListItem).not.toHaveBeenCalled();
  });
});
