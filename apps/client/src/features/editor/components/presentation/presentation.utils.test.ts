import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import {
  findSlideIndexForNode,
  getContentBoxHeight,
  getDeckKeyAction,
  isBlankBlock,
  type MeasuredBlock,
  paginateBlocks,
  sameSlideLayouts,
  shouldReturnFocusToSlide,
} from "./presentation.utils";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    image: { group: "block", atom: true, toDOM: () => ["img"] },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true, toDOM: () => ["br"] },
    mention: { group: "inline", inline: true, atom: true, toDOM: () => ["span"] },
  },
});

let nextIndex = 0;
function block(height: number, overrides: Partial<MeasuredBlock> = {}): MeasuredBlock {
  const index = overrides.index ?? nextIndex++;
  const top = overrides.top ?? index * 1000;
  return {
    index,
    type: "paragraph",
    blank: false,
    top,
    bottom: top + height,
    marginTop: 0,
    marginBottom: 0,
    ...overrides,
  };
}

function stacked(heights: number[], gap = 0, type = "paragraph"): MeasuredBlock[] {
  let top = 0;
  return heights.map((height, index) => {
    const result = block(height, { index, top, type });
    top += height + gap;
    return result;
  });
}

type BlockSpec = [type: string, height: number, headingLevel?: number];

function sequence(...specs: BlockSpec[]): MeasuredBlock[] {
  return stacked(specs.map(([, height]) => height)).map((measured, index) => ({
    ...measured,
    type: specs[index][0],
    headingLevel: specs[index][2],
  }));
}

const indexes = (slides: { nodeIndexes: number[] }[]) =>
  slides.map((slide) => slide.nodeIndexes);

describe("isBlankBlock", () => {
  const paragraph = (...content: ReturnType<typeof schema.text>[]) =>
    schema.nodes.paragraph.create(null, content);

  it("treats empty, whitespace, nbsp and hardBreak-only paragraphs as blank", () => {
    expect(isBlankBlock(paragraph())).toBe(true);
    expect(isBlankBlock(paragraph(schema.text("   ")))).toBe(true);
    expect(isBlankBlock(paragraph(schema.text("\u00a0")))).toBe(true);
    expect(isBlankBlock(paragraph(schema.nodes.hardBreak.create()))).toBe(true);
  });

  it("keeps paragraphs with text or inline atoms", () => {
    expect(isBlankBlock(paragraph(schema.text("Hi")))).toBe(false);
    expect(isBlankBlock(paragraph(schema.nodes.mention.create()))).toBe(false);
  });

  it("never treats non-textblocks as blank", () => {
    expect(isBlankBlock(schema.nodes.image.create())).toBe(false);
  });
});

describe("getContentBoxHeight", () => {
  const area = (clientHeight: number, padding: { top?: string; bottom?: string } = {}) => {
    const element = document.createElement("div");
    element.style.paddingTop = padding.top ?? "";
    element.style.paddingBottom = padding.bottom ?? "";
    Object.defineProperty(element, "clientHeight", { value: clientHeight });
    document.body.appendChild(element);
    return element;
  };

  it("subtracts the vertical padding from the client height", () => {
    expect(getContentBoxHeight(area(600, { top: "20px", bottom: "10px" }))).toBe(570);
  });

  it("treats padding that does not resolve to a number as zero", () => {
    expect(getContentBoxHeight(area(600))).toBe(600);
  });
});

describe("paginateBlocks", () => {
  it("keeps blocks that fit on one slide", () => {
    const slides = paginateBlocks(stacked([100, 100, 100], 10), 500);
    expect(indexes(slides)).toEqual([[0, 1, 2]]);
    expect(slides[0].scrollable).toBe(false);
  });

  it("starts a new slide when the next block would overflow", () => {
    expect(indexes(paginateBlocks(stacked([300, 300, 300], 0), 650))).toEqual([[0, 1], [2]]);
  });

  it("counts the first block's top margin and the last block's bottom margin", () => {
    const blocks = stacked([300, 300], 0).map((b) => ({ ...b, marginTop: 30, marginBottom: 30 }));
    expect(indexes(paginateBlocks(blocks, 640))).toEqual([[0], [1]]);
    expect(indexes(paginateBlocks(blocks, 660))).toEqual([[0, 1]]);
  });

  it("counts the gap between adjacent blocks", () => {
    const blocks = stacked([300, 300, 300], 20);
    expect(indexes(paginateBlocks(blocks, 930))).toEqual([[0, 1], [2]]);
    expect(indexes(paginateBlocks(blocks, 940))).toEqual([[0, 1, 2]]);
  });

  it("uses the larger margin as the gap across a skipped blank block", () => {
    for (const [marginBottom, marginTop] of [[10, 30], [30, 10]]) {
      const blocks = [
        block(200, { index: 0, top: 0, marginBottom }),
        block(400, { index: 1, top: 210, blank: true }),
        block(200, { index: 2, top: 640, marginTop }),
      ];
      expect(indexes(paginateBlocks(blocks, 425))).toEqual([[0], [2]]);
      expect(indexes(paginateBlocks(blocks, 435))).toEqual([[0, 2]]);
    }
  });

  it("splits on dividers and drops them", () => {
    const blocks = stacked([100, 10, 100], 0);
    blocks[1].type = "horizontalRule";
    expect(indexes(paginateBlocks(blocks, 1000))).toEqual([[0], [2]]);
  });

  it("starts a new slide at every H1", () => {
    const blocks = stacked([50, 50, 50], 0);
    blocks[1] = { ...blocks[1], type: "heading", headingLevel: 1 };
    blocks[2] = { ...blocks[2], type: "heading", headingLevel: 2 };
    expect(indexes(paginateBlocks(blocks, 1000))).toEqual([[0], [1, 2]]);
  });

  it("ends the slide after a table or base", () => {
    const blocks = stacked([50, 50, 50, 50], 0);
    blocks[1].type = "table";
    blocks[2].type = "base";
    expect(indexes(paginateBlocks(blocks, 1000))).toEqual([[0, 1], [2], [3]]);
  });

  it("skips blank blocks and never emits an empty slide", () => {
    const blocks = stacked([10, 50, 50, 10], 0);
    blocks[0].type = "horizontalRule";
    blocks[1].blank = true;
    blocks[2] = { ...blocks[2], type: "heading", headingLevel: 1 };
    blocks[3].type = "horizontalRule";
    expect(indexes(paginateBlocks(blocks, 1000))).toEqual([[2]]);
  });

  it("does not count the height of skipped blank blocks", () => {
    const blocks = stacked([200, 400, 200], 0);
    blocks[1].blank = true;
    expect(indexes(paginateBlocks(blocks, 450))).toEqual([[0, 2]]);
  });

  describe("zero-height blocks", () => {
    const divider: BlockSpec = ["horizontalRule", 10];
    const pageBreak: BlockSpec = ["pageBreak", 0];
    const heading: BlockSpec = ["heading", 50, 1];
    const paragraph: BlockSpec = ["paragraph", 50];
    const table: BlockSpec = ["table", 50];
    const cases: [string, BlockSpec[], number[][]][] = [
      ["divider, page break, H1", [divider, pageBreak, heading], [[2]]],
      ["divider, page break, H1, paragraph", [divider, pageBreak, heading, paragraph], [[2, 3]]],
      ["table, page break, H1, paragraph", [table, pageBreak, heading, paragraph], [[0], [2, 3]]],
      ["page break, H1, paragraph", [pageBreak, heading, paragraph], [[1, 2]]],
      ["paragraph, table, page break", [paragraph, table, pageBreak], [[0, 1]]],
    ];

    it.each(cases)("never gives a page break a slide of its own: %s", (_label, specs, expected) => {
      expect(indexes(paginateBlocks(sequence(...specs), 1000))).toEqual(expected);
    });

    it("still splits on a zero-height divider", () => {
      const slides = paginateBlocks(sequence(paragraph, ["horizontalRule", 0], paragraph), 1000);
      expect(indexes(slides)).toEqual([[0], [2]]);
    });
  });

  it("marks a block taller than the area as a scrollable slide of its own", () => {
    const slides = paginateBlocks(stacked([100, 900, 100], 0), 500);
    expect(indexes(slides)).toEqual([[0], [1], [2]]);
    expect(slides.map((slide) => slide.scrollable)).toEqual([false, true, false]);
  });

  it("returns no slides for an empty or blank-only document", () => {
    expect(paginateBlocks([], 500)).toEqual([]);
    expect(paginateBlocks(stacked([0, 0]).map((b) => ({ ...b, blank: true })), 500)).toEqual([]);
  });
});

describe("findSlideIndexForNode", () => {
  const slides = [
    { nodeIndexes: [0, 1], scrollable: false },
    { nodeIndexes: [3, 4], scrollable: false },
    { nodeIndexes: [6], scrollable: false },
  ];

  it("finds the slide containing the node", () => {
    expect(findSlideIndexForNode(slides, 4)).toBe(1);
  });

  it("falls forward to the next slide for a skipped node", () => {
    expect(findSlideIndexForNode(slides, 2)).toBe(1);
  });

  it("clamps to the last slide", () => {
    expect(findSlideIndexForNode(slides, 9)).toBe(2);
  });

  it("returns -1 when there are no slides", () => {
    expect(findSlideIndexForNode([], 3)).toBe(-1);
  });
});

describe("sameSlideLayouts", () => {
  it("compares node indexes and scrollable flags", () => {
    const a = [{ nodeIndexes: [0, 1], scrollable: false }];
    expect(sameSlideLayouts(a, [{ nodeIndexes: [0, 1], scrollable: false }])).toBe(true);
    expect(sameSlideLayouts(a, [{ nodeIndexes: [0, 1], scrollable: true }])).toBe(false);
    expect(sameSlideLayouts(a, [{ nodeIndexes: [0], scrollable: false }])).toBe(false);
    expect(sameSlideLayouts(null, a)).toBe(false);
  });
});

function keyEvent(key: string, target: Element = document.body, extra: Partial<KeyboardEvent> = {}) {
  return { key, target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...extra };
}

function element(html: string, selector: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.querySelector(selector);
}

describe("getDeckKeyAction", () => {
  it("maps navigation keys", () => {
    expect(getDeckKeyAction(keyEvent("ArrowRight"), null)).toBe("next");
    expect(getDeckKeyAction(keyEvent("Enter"), null)).toBe("next");
    expect(getDeckKeyAction(keyEvent("ArrowLeft"), null)).toBe("previous");
    expect(getDeckKeyAction(keyEvent("ArrowDown"), null)).toBe("lineDown");
    expect(getDeckKeyAction(keyEvent("ArrowUp"), null)).toBe("lineUp");
    expect(getDeckKeyAction(keyEvent("PageDown"), null)).toBe("pageDown");
    expect(getDeckKeyAction(keyEvent(" "), null)).toBe("pageDown");
    expect(getDeckKeyAction(keyEvent("PageUp"), null)).toBe("pageUp");
    expect(getDeckKeyAction(keyEvent("Home"), null)).toBe("first");
    expect(getDeckKeyAction(keyEvent("End"), null)).toBe("last");
    expect(getDeckKeyAction(keyEvent("Escape"), null)).toBeNull();
  });

  it("ignores modified and already handled keys", () => {
    expect(getDeckKeyAction(keyEvent("ArrowRight", document.body, { metaKey: true }), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent("f", document.body, { ctrlKey: true }), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent(" ", document.body, { shiftKey: true }), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent("ArrowRight", document.body, { defaultPrevented: true }), null)).toBeNull();
  });

  it("leaves typing targets alone", () => {
    expect(getDeckKeyAction(keyEvent("ArrowRight", element("<input />", "input")), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent(" ", element('<div contenteditable="true">x</div>', "div")), null)).toBeNull();
  });

  it("lets Space and Enter activate focused buttons", () => {
    const button = element("<button>Prev</button>", "button");
    expect(getDeckKeyAction(keyEvent(" ", button), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent("Enter", button), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent("ArrowRight", button), null)).toBe("next");
  });

  it("lets Enter activate a focused link while Space still moves the slide", () => {
    const link = element('<a href="/x">x</a>', "a");
    expect(getDeckKeyAction(keyEvent("Enter", link), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent(" ", link), null)).toBe("pageDown");
  });

  it("keeps Enter reserved for every interactive target", () => {
    const cases: [string, string][] = [
      ['<div role="link" tabindex="0">Docs</div>', "div"],
      ["<label>Name</label>", "label"],
      ['<div class="node-base"><div>cell</div></div>', ".node-base > div"],
    ];
    for (const [html, selector] of cases) {
      expect(getDeckKeyAction(keyEvent("Enter", element(html, selector)), null)).toBeNull();
    }
  });

  it("exempts Space only for targets that Space activates", () => {
    const activated: [string, string][] = [
      ["<details><summary>More</summary></details>", "summary"],
      ['<div role="button" tabindex="0">Copy</div>', "div"],
      ['<div role="tablist"><button role="tab">A</button></div>', '[role="tab"]'],
      ['<div role="checkbox" tabindex="0">Done</div>', "div"],
      ['<div role="menuitem" tabindex="0">Rename</div>', "div"],
      ["<video controls></video>", "video"],
      ["<audio controls></audio>", "audio"],
    ];
    for (const [html, selector] of activated) {
      expect(getDeckKeyAction(keyEvent(" ", element(html, selector)), null)).toBeNull();
    }

    const notActivated: [string, string][] = [
      ['<div role="link" tabindex="0">Docs</div>', "div"],
      ["<label>Name</label>", "label"],
    ];
    for (const [html, selector] of notActivated) {
      expect(getDeckKeyAction(keyEvent(" ", element(html, selector)), null)).toBe("pageDown");
    }
  });

  it("leaves horizontal arrows to a focused tab list", () => {
    const tab = element('<div role="tablist"><button role="tab">A</button></div>', '[role="tab"]');
    expect(getDeckKeyAction(keyEvent("ArrowRight", tab), null)).toBeNull();
    expect(getDeckKeyAction(keyEvent("PageDown", tab), null)).toBe("pageDown");
  });

  describe("overlays opened from slide content", () => {
    const deckElement = () => element("<div></div>", "div");

    it("ignores keys inside a dialog or menu that does not hold the deck", () => {
      const dialog = element('<div role="dialog"><span>Filter</span></div>', "span");
      const menu = element('<div role="menu"><span>Sort</span></div>', "span");
      expect(getDeckKeyAction(keyEvent("ArrowRight", dialog), deckElement())).toBeNull();
      expect(getDeckKeyAction(keyEvent(" ", dialog), deckElement())).toBeNull();
      expect(getDeckKeyAction(keyEvent("ArrowRight", menu), deckElement())).toBeNull();
    });

    it("still navigates from inside the dialog that holds the deck", () => {
      const slide = element('<div role="dialog"><div class="stage"><span>Slide</span></div></div>', "span");
      expect(getDeckKeyAction(keyEvent("ArrowRight", slide), slide.closest(".stage"))).toBe("next");
    });

    it("navigates from a target outside any overlay when the deck element is known", () => {
      expect(getDeckKeyAction(keyEvent("ArrowRight"), deckElement())).toBe("next");
    });

    it("ignores keys inside an overlay nested in the deck's own dialog", () => {
      const html =
        '<div role="dialog"><div class="stage"></div><div role="dialog"><span>Filter</span></div></div>';
      const nested = element(html, 'div[role="dialog"] div[role="dialog"] span');
      const stage = nested.parentElement.parentElement.querySelector(".stage");
      expect(getDeckKeyAction(keyEvent("ArrowRight", nested), stage)).toBeNull();
    });

    it("skips the overlay check without a deck element", () => {
      const dialog = element('<div role="dialog"><span>Filter</span></div>', "span");
      expect(getDeckKeyAction(keyEvent("ArrowRight", dialog), null)).toBe("next");
    });
  });
});

describe("shouldReturnFocusToSlide", () => {
  const slide = (html: string, selector: string) => {
    const host = document.createElement("div");
    host.innerHTML = `<div class="slide">${html}</div>`;
    document.body.appendChild(host);
    return { area: host.firstElementChild, active: host.querySelector(selector) };
  };

  it("returns focus from a control clicked inside the slide", () => {
    const cases: [string, string][] = [
      ["<button>Copy</button>", "button"],
      ['<div role="tablist"><button role="tab"><span>Tab 2</span></button></div>', "button"],
    ];
    for (const [html, selector] of cases) {
      const { area, active } = slide(html, selector);
      expect(shouldReturnFocusToSlide(active, area)).toBe(true);
    }
  });

  it("leaves text entry inside the slide alone", () => {
    const cases: [string, string][] = [
      ["<input />", "input"],
      ["<textarea></textarea>", "textarea"],
      ['<div contenteditable="true"><span>x</span></div>', "span"],
    ];
    for (const [html, selector] of cases) {
      const { area, active } = slide(html, selector);
      expect(shouldReturnFocusToSlide(active, area)).toBe(false);
    }
  });

  it("leaves a focused video or audio control alone", () => {
    const cases: [string, string][] = [
      ["<video controls></video>", "video"],
      ["<audio controls></audio>", "audio"],
    ];
    for (const [html, selector] of cases) {
      const { area, active } = slide(html, selector);
      expect(shouldReturnFocusToSlide(active, area)).toBe(false);
    }
  });

  it("leaves focus inside an embedded base alone", () => {
    const { area, active } = slide('<div class="node-base"><button>Filter</button></div>', "button");
    expect(shouldReturnFocusToSlide(active, area)).toBe(false);
  });

  it("ignores focus outside the slide, on the slide itself, or nowhere", () => {
    const { area } = slide("<p>Text</p>", "p");
    const outside = element("<button>Outside</button>", "button");
    expect(shouldReturnFocusToSlide(outside, area)).toBe(false);
    expect(shouldReturnFocusToSlide(area, area)).toBe(false);
    expect(shouldReturnFocusToSlide(null, area)).toBe(false);
  });
});
