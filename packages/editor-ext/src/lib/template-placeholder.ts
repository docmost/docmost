import { getHTMLFromFragment, Node, type Editor } from '@tiptap/core';
import { Fragment, type Mark, type Node as PMNode } from '@tiptap/pm/model';
import { PluginKey } from '@tiptap/pm/state';

export type HintSide = 'nodeBefore' | 'nodeAfter';
export const activeTemplatePlaceholder = new PluginKey<HintSide | null>(
  'activeTemplatePlaceholder',
);

// Yjs stores no marks on inline nodes, so a page's hint takes the formatting
// of the text before it.
export function hintMarks(doc: PMNode, pos: number): readonly Mark[] {
  const hint = doc.nodeAt(pos);
  return hint?.marks.length ? hint.marks : doc.resolve(pos).marks();
}

// Remove the entire inline node before the serializer opens its marks. An
// empty span inside a link would otherwise export the instruction's URL.
export function withoutTemplatePlaceholders(fragment: Fragment): Fragment {
  let children: PMNode[] | undefined;
  fragment.forEach((node, _offset, index) => {
    let child: PMNode | null = node;
    if (node.type.name === 'templatePlaceholder') child = null;
    else if (!node.isLeaf)
      child = node.copy(withoutTemplatePlaceholders(node.content));
    if (child !== node && !children)
      children = fragment.content.slice(0, index);
    if (children && child) children.push(child);
  });
  return children ? Fragment.from(children) : fragment;
}

export function getPageHTML(editor: Editor): string {
  return getHTMLFromFragment(
    withoutTemplatePlaceholders(editor.state.doc.content),
    editor.schema,
  );
}

export const TemplatePlaceholder = Node.create({
  name: 'templatePlaceholder',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { hint: { default: '', validate: 'string', rendered: false } };
  },

  // The editor supplies the visible hint. HTML exports and the clipboard
  // serialize this node without its instruction.
  renderHTML() {
    return ['span'];
  },

  renderText() {
    return '';
  },
});
