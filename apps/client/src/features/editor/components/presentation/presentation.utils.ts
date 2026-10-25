import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type MeasuredBlock = {
  index: number;
  type: string;
  headingLevel?: number;
  blank: boolean;
  top: number;
  bottom: number;
  marginTop: number;
  marginBottom: number;
};

export type SlideLayout = {
  nodeIndexes: number[];
  scrollable: boolean;
};

export type DeckKeyAction =
  | "next"
  | "previous"
  | "first"
  | "last"
  | "lineDown"
  | "lineUp"
  | "pageDown"
  | "pageUp";

type DeckKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "target"
  | "defaultPrevented"
>;

const deckKeyActions: Record<string, DeckKeyAction> = {
  ArrowRight: "next",
  Enter: "next",
  ArrowLeft: "previous",
  Home: "first",
  End: "last",
  ArrowDown: "lineDown",
  ArrowUp: "lineUp",
  PageDown: "pageDown",
  " ": "pageDown",
  PageUp: "pageUp",
};

const interactiveSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "video",
  "audio",
  "iframe",
  '[role="button"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  ".node-base",
].join(", ");

const spaceActivatedSelector = [
  "button",
  "summary",
  'input[type="checkbox"]',
  'input[type="radio"]',
  "video",
  "audio",
  '[role="button"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
].join(", ");

const textEntrySelector = 'input, textarea, select, [contenteditable="true"]';

const overlaySelector = '[role="dialog"], [role="menu"]';

const isDivider = (block: MeasuredBlock) => block.type === "horizontalRule";

const isSectionHeading = (block: MeasuredBlock) =>
  block.type === "heading" && block.headingLevel === 1;

const endsSection = (block: MeasuredBlock) =>
  block.type === "table" || block.type === "base";

function closestFrom(target: EventTarget | null, selector: string) {
  return target instanceof Element ? target.closest(selector) : null;
}

function gapBetween(previous: MeasuredBlock, next: MeasuredBlock) {
  if (next.index === previous.index + 1) return next.top - previous.bottom;
  return Math.max(previous.marginBottom, next.marginTop);
}

export function isBlankBlock(node: ProseMirrorNode): boolean {
  if (!node.isTextblock) return false;

  let blank = true;
  node.forEach((child) => {
    if (child.isText ? child.text?.trim() : child.type.name !== "hardBreak") {
      blank = false;
    }
  });
  return blank;
}

export function measureBlocks(editor: Editor): MeasuredBlock[] {
  const blocks: MeasuredBlock[] = [];

  editor.state.doc.forEach((node, offset, index) => {
    const dom = editor.view.nodeDOM(offset);
    const block: MeasuredBlock = {
      index,
      type: node.type.name,
      headingLevel: node.type.name === "heading" ? node.attrs.level : undefined,
      blank: true,
      top: 0,
      bottom: 0,
      marginTop: 0,
      marginBottom: 0,
    };

    if (dom instanceof HTMLElement && dom.offsetParent !== null) {
      const style = window.getComputedStyle(dom);
      block.blank = isBlankBlock(node);
      block.top = dom.offsetTop;
      block.bottom = dom.offsetTop + dom.offsetHeight;
      block.marginTop = parseFloat(style.marginTop) || 0;
      block.marginBottom = parseFloat(style.marginBottom) || 0;
    }

    blocks.push(block);
  });

  return blocks;
}

export function getContentBoxHeight(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return (
    element.clientHeight -
    (parseFloat(style.paddingTop) || 0) -
    (parseFloat(style.paddingBottom) || 0)
  );
}

export function paginateBlocks(
  blocks: MeasuredBlock[],
  availableHeight: number,
): SlideLayout[] {
  const slides: SlideLayout[] = [];
  let current: MeasuredBlock[] = [];
  let currentHeight = 0;

  const closeSlide = () => {
    if (!current.length) return;
    slides.push({
      nodeIndexes: current.map((block) => block.index),
      scrollable: currentHeight > availableHeight,
    });
    current = [];
    currentHeight = 0;
  };

  for (const block of blocks) {
    if (block.blank) continue;
    if (isDivider(block)) {
      closeSlide();
      continue;
    }
    // page breaks lay out with zero height and must never form a slide
    if (block.bottom <= block.top) continue;

    const blockHeight = block.bottom - block.top;
    const previous = current[current.length - 1];
    const extendedHeight = previous
      ? currentHeight -
        previous.marginBottom +
        gapBetween(previous, block) +
        blockHeight +
        block.marginBottom
      : 0;

    if (previous && !isSectionHeading(block) && extendedHeight <= availableHeight) {
      current.push(block);
      currentHeight = extendedHeight;
    } else {
      closeSlide();
      current.push(block);
      currentHeight = block.marginTop + blockHeight + block.marginBottom;
    }

    if (endsSection(block)) closeSlide();
  }

  closeSlide();
  return slides;
}

export function findSlideIndexForNode(
  slides: SlideLayout[],
  nodeIndex: number,
): number {
  const position = slides.findIndex(
    (slide) => slide.nodeIndexes[slide.nodeIndexes.length - 1] >= nodeIndex,
  );
  return position === -1 ? slides.length - 1 : position;
}

export function sameSlideLayouts(
  previous: SlideLayout[] | null,
  next: SlideLayout[],
): boolean {
  return (
    previous !== null &&
    previous.length === next.length &&
    previous.every(
      (slide, index) =>
        slide.scrollable === next[index].scrollable &&
        slide.nodeIndexes.join() === next[index].nodeIndexes.join(),
    )
  );
}

export function getDeckKeyAction(
  event: DeckKeyEvent,
  deckElement: Element | null,
): DeckKeyAction | null {
  if (event.defaultPrevented) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;

  const action = deckKeyActions[event.key];
  if (!action || closestFrom(event.target, textEntrySelector)) return null;

  if (event.key === "Enter" && closestFrom(event.target, interactiveSelector)) return null;
  if (event.key === " " && closestFrom(event.target, spaceActivatedSelector)) return null;

  const movesBetweenTabs = event.key === "ArrowLeft" || event.key === "ArrowRight";
  if (movesBetweenTabs && closestFrom(event.target, '[role="tablist"]')) return null;

  const overlay = closestFrom(event.target, overlaySelector);
  if (overlay && deckElement && !overlay.contains(deckElement)) return null;

  return action;
}

export function shouldReturnFocusToSlide(
  active: Element | null,
  slideArea: Element,
): boolean {
  if (!active || active === slideArea || !slideArea.contains(active)) return false;
  return !active.closest(`${textEntrySelector}, video, audio, .node-base`);
}

export function setEditorPageId(editor: Editor, pageId: string): void {
  (editor.storage as unknown as { pageId?: string }).pageId = pageId;
}
