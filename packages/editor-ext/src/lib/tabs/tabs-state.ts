import type { Fragment, Node as PMNode } from '@tiptap/pm/model';
import {
  Mapping,
  ReplaceAroundStep,
  ReplaceStep,
  StepMap,
  type Step,
} from '@tiptap/pm/transform';
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { getPanelContentPos, isTabsNode } from './tabs.utils';

type ActiveTab = { tabId: string; index: number };

type ActiveTabUpdate = ActiveTab & { tabsPos: number };

type TabsViewState = {
  active: Map<number, ActiveTab>;
  decorations: DecorationSet;
};

const tabsViewPluginKey = new PluginKey<TabsViewState>('tabsView');

function resolveActiveIndex(tabs: PMNode, entry: ActiveTab | undefined) {
  if (!entry) return 0;
  if (entry.tabId) {
    for (let i = 0; i < tabs.childCount; i += 1) {
      if (tabs.child(i).attrs.id === entry.tabId) return i;
    }
  }
  return Math.min(entry.index, tabs.childCount - 1);
}

export function getActiveTabIndex(state: EditorState, tabsPos: number) {
  const tabs = state.doc.nodeAt(tabsPos);
  if (!isTabsNode(tabs)) return 0;
  const active = tabsViewPluginKey.getState(state)?.active;
  return resolveActiveIndex(tabs, active?.get(tabsPos));
}

export function setActiveTabMeta(tr: Transaction, update: ActiveTabUpdate) {
  const updates: ActiveTabUpdate[] = tr.getMeta(tabsViewPluginKey) ?? [];
  return tr.setMeta(tabsViewPluginKey, [...updates, update]);
}

type StepChange = {
  map: StepMap;
  // where in the doc after the step tabs were added, removed or split
  tabsChange: { from: number; to: number } | null;
};

const isTabOrTabs = (node: PMNode) =>
  node.type.name === 'tabs' || node.type.name === 'tab';

function containsTabs(fragment: Fragment) {
  let found = false;
  fragment.descendants((node) => {
    if (found || node.isTextblock) return false;
    found = isTabOrTabs(node);
    return !found;
  });
  return found;
}

// a tab that starts or ends inside the range, rather than enclosing it
function hasTabBoundary(doc: PMNode, from: number, to: number) {
  let found = false;
  doc.nodesBetween(from, to, (node, pos) => {
    if (found || node.isTextblock) return false;
    found = isTabOrTabs(node) && (pos >= from || pos + node.nodeSize <= to);
    return !found;
  });
  return found;
}

// remote updates and undo replace the whole doc, so diff it to find the real change
function diffChange(before: PMNode, after: PMNode): StepChange {
  const from = before.content.findDiffStart(after.content);
  if (from == null) return { map: StepMap.empty, tabsChange: null };
  let { a: toA, b: toB } = before.content.findDiffEnd(after.content)!;
  // the scan from the end can run past the start when the edit repeats nearby content
  const overlap = from - Math.min(toA, toB);
  if (overlap > 0) {
    toA += overlap;
    toB += overlap;
  }
  const changesTabs =
    hasTabBoundary(before, from, toA) || hasTabBoundary(after, from, toB);
  return {
    map: new StepMap([from, toA - from, toB - from]),
    tabsChange: changesTabs ? { from, to: toB } : null,
  };
}

function describeStep(step: Step, before: PMNode, after: PMNode): StepChange {
  if (
    step instanceof ReplaceStep &&
    step.from === 0 &&
    step.to === before.content.size
  ) {
    return diffChange(before, after);
  }

  const map = step.getMap();
  if (step instanceof ReplaceStep) {
    const changesTabs =
      containsTabs(step.slice.content) ||
      (step.from < step.to && hasTabBoundary(before, step.from, step.to));
    return {
      map,
      tabsChange: changesTabs
        ? { from: step.from, to: step.from + step.slice.size }
        : null,
    };
  }
  if (step instanceof ReplaceAroundStep) {
    return {
      map,
      tabsChange: { from: map.map(step.from, -1), to: map.map(step.to, 1) },
    };
  }
  return { map, tabsChange: null };
}

function findTabsBlocks(doc: PMNode, from: number, to: number) {
  const positions: number[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (isTabsNode(node)) positions.push(pos);
    return !node.isTextblock;
  });
  return positions;
}

function mapActiveTabs(
  active: Map<number, ActiveTab>,
  mapping: Mapping,
  doc: PMNode,
  changedBlocks: number[] | null,
) {
  const mapped = new Map<number, ActiveTab>();
  const lost: ActiveTab[] = [];
  active.forEach((entry, pos) => {
    const result = mapping.mapResult(pos, 1);
    // only a change to the tabs themselves can leave something else at the position
    const isBlock =
      !result.deleted &&
      (!changedBlocks || isTabsNode(doc.nodeAt(result.pos)));
    if (isBlock) mapped.set(result.pos, entry);
    else lost.push(entry);
  });
  if (!lost.length || !changedBlocks) return mapped;

  // a block rebuilt by the change is found again by its tab ids
  const blockByTabId = new Map<string, number | null>();
  changedBlocks.forEach((pos) => {
    doc.nodeAt(pos)!.forEach((tab) => {
      const known = blockByTabId.get(tab.attrs.id);
      // an id shared by two blocks (pasted copies) can't be told apart
      blockByTabId.set(
        tab.attrs.id,
        known === undefined || known === pos ? pos : null,
      );
    });
  });
  lost.forEach((entry) => {
    const pos = entry.tabId ? blockByTabId.get(entry.tabId) : null;
    if (pos != null && !mapped.has(pos)) mapped.set(pos, entry);
  });
  return mapped;
}

function hiddenTabDecorations(
  tabs: PMNode,
  tabsPos: number,
  active: Map<number, ActiveTab>,
) {
  const activeIndex = resolveActiveIndex(tabs, active.get(tabsPos));
  const decorations: Decoration[] = [];
  tabs.forEach((tab, offset, index) => {
    if (index === activeIndex) return;
    const from = tabsPos + 1 + offset;
    // until-found lets find in page reach the tab and fire beforematch on it
    decorations.push(
      Decoration.node(from, from + tab.nodeSize, {
        class: 'dm-tab-hidden',
        hidden: 'until-found',
      }),
    );
  });
  return decorations;
}

function buildDecorations(doc: PMNode, active: Map<number, ActiveTab>) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (isTabsNode(node)) {
      decorations.push(...hiddenTabDecorations(node, pos, active));
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

// swaps only this block's own decorations, leaving those of nested blocks alone
function redecorateBlock(
  decorations: DecorationSet,
  doc: PMNode,
  tabsPos: number,
  active: Map<number, ActiveTab>,
) {
  const tabs = doc.nodeAt(tabsPos);
  if (!isTabsNode(tabs)) return decorations;

  const tabEnds = new Map<number, number>();
  tabs.forEach((tab, offset) => {
    const from = tabsPos + 1 + offset;
    tabEnds.set(from, from + tab.nodeSize);
  });
  const stale = decorations
    .find(tabsPos + 1, tabsPos + tabs.nodeSize - 1)
    .filter((decoration) => tabEnds.get(decoration.from) === decoration.to);
  return decorations
    .remove(stale)
    .add(doc, hiddenTabDecorations(tabs, tabsPos, active));
}

function findVisibleHead(
  doc: PMNode,
  tabs: PMNode,
  tabsPos: number,
  activeIndex: number,
  head: number,
  previousHead: number | null,
) {
  const panelPos = getPanelContentPos(tabs, tabsPos, activeIndex);
  const panelEnd = panelPos + tabs.child(activeIndex).lastChild!.content.size;
  if (previousHead !== null) {
    // moving off either end of the visible panel leaves the block that way
    if (previousHead >= panelPos && previousHead <= panelEnd) {
      const forward = head > previousHead;
      const exit = Selection.findFrom(
        doc.resolve(forward ? tabsPos + tabs.nodeSize : tabsPos),
        forward ? 1 : -1,
      );
      if (exit) return exit;
    }
    // moving up into the block from below lands at the end of the visible panel
    if (previousHead >= tabsPos + tabs.nodeSize) {
      return Selection.near(doc.resolve(panelEnd), -1);
    }
  }
  return Selection.near(doc.resolve(panelPos));
}

// the cursor never rests in a hidden label, an inactive tab, or between tabs
function findVisibleSelection(
  state: EditorState,
  selection: Selection,
  previousHead: number | null,
) {
  const { $head } = selection;
  for (let depth = 1; depth <= $head.depth; depth += 1) {
    const tabs = $head.node(depth);
    if (!isTabsNode(tabs)) continue;

    const tabsPos = $head.before(depth);
    const activeIndex = resolveActiveIndex(
      tabs,
      tabsViewPluginKey.getState(state)?.active.get(tabsPos),
    );
    const betweenTabs = depth === $head.depth;
    const inLabel =
      depth + 2 <= $head.depth &&
      $head.node(depth + 2).type.name === 'tabLabel';
    if (betweenTabs || inLabel || $head.index(depth) !== activeIndex) {
      const visible = findVisibleHead(
        state.doc,
        tabs,
        tabsPos,
        activeIndex,
        $head.pos,
        previousHead,
      );
      // a shift-extended selection keeps its anchor
      return selection instanceof TextSelection && !selection.empty
        ? TextSelection.between(selection.$anchor, visible.$head)
        : visible;
    }
  }
  return null;
}

export function tabsViewPlugin() {
  return new Plugin<TabsViewState>({
    key: tabsViewPluginKey,
    state: {
      init: (_, state) => ({
        active: new Map(),
        decorations: buildDecorations(state.doc, new Map()),
      }),
      apply(tr, value) {
        const updates: ActiveTabUpdate[] | undefined =
          tr.getMeta(tabsViewPluginKey);
        if (!tr.docChanged && !updates) return value;

        let { active, decorations } = value;
        const changedBlocks: number[] = [];
        if (tr.docChanged) {
          const changes = tr.steps.map((step, index) =>
            describeStep(step, tr.docs[index], tr.docs[index + 1] ?? tr.doc),
          );
          const mapping = new Mapping(changes.map((change) => change.map));
          let tabsChanged = false;
          changes.forEach(({ tabsChange }, index) => {
            if (!tabsChange) return;
            tabsChanged = true;
            const rest = mapping.slice(index + 1);
            changedBlocks.push(
              ...findTabsBlocks(
                tr.doc,
                rest.map(tabsChange.from, -1),
                rest.map(tabsChange.to, 1),
              ),
            );
          });
          active = mapActiveTabs(
            active,
            mapping,
            tr.doc,
            tabsChanged ? changedBlocks : null,
          );
          decorations = decorations.map(mapping, tr.doc);
        }
        if (updates) {
          active = new Map(active);
          updates.forEach(({ tabsPos, tabId, index }) => {
            active.set(tabsPos, { tabId, index });
            changedBlocks.push(tabsPos);
          });
        }
        new Set(changedBlocks).forEach((tabsPos) => {
          decorations = redecorateBlock(decorations, tr.doc, tabsPos, active);
        });
        return { active, decorations };
      },
    },
    props: {
      decorations: (state) => tabsViewPluginKey.getState(state)?.decorations,
    },
    appendTransaction(_transactions, oldState, newState) {
      // only a pure selection move, such as an arrow key, leaves the panel
      const previousHead =
        oldState.doc === newState.doc ? oldState.selection.head : null;
      let selection = newState.selection;
      let next = findVisibleSelection(newState, selection, previousHead);
      if (next === null) return null;
      // the plugin never sees its own transaction, so settle nested tabs here
      for (let pass = 0; next !== null && pass < 8; pass += 1) {
        selection = next;
        next = findVisibleSelection(newState, selection, previousHead);
      }
      return newState.tr.setSelection(selection);
    },
  });
}
