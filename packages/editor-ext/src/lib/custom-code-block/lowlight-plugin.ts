import type { NodeWithPos } from '@tiptap/core';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
// @ts-ignore
import highlight from 'highlight.js/lib/core';
import { createFindChildren } from '../utils';

// positions count from the start of the code block's text
type Token = { from: number; to: number; class: string };

function parseNodes(
  nodes: any[],
  className: string[] = [],
): { text: string; classes: string[] }[] {
  return nodes
    .map((node) => {
      const classes = [
        ...className,
        ...(node.properties ? node.properties.className : []),
      ];

      if (node.children) {
        return parseNodes(node.children, classes);
      }

      return {
        text: node.value,
        classes,
      };
    })
    .flat();
}

function getHighlightNodes(result: any) {
  // `.value` for lowlight v1, `.children` for lowlight v2
  return result.value || result.children || [];
}

function registered(aliasOrLanguage: string) {
  return Boolean(highlight.getLanguage(aliasOrLanguage));
}

// Max characters to sample for auto-detection to avoid performance issues with large code blocks
const AUTO_DETECT_SAMPLE_SIZE = 3000;

function highlightBlock(
  block: ProsemirrorNode,
  lowlight: any,
  defaultLanguage: string | null | undefined,
): Token[] {
  const tokens: Token[] = [];
  let from = 0;
  const language = block.attrs.language || defaultLanguage;
  const languages = lowlight.listLanguages();
  const textContent = block.textContent;

  let nodes;
  if (
    language &&
    (languages.includes(language) ||
      registered(language) ||
      lowlight.registered?.(language))
  ) {
    nodes = getHighlightNodes(lowlight.highlight(language, textContent));
  } else {
    // For auto-detection, sample a limited portion to detect the language,
    // then highlight the full content with the detected language
    const sample =
      textContent.length > AUTO_DETECT_SAMPLE_SIZE
        ? textContent.slice(0, AUTO_DETECT_SAMPLE_SIZE)
        : textContent;
    const autoResult = lowlight.highlightAuto(sample);
    const detectedLanguage = autoResult.data?.language;
    if (detectedLanguage && textContent.length > AUTO_DETECT_SAMPLE_SIZE) {
      nodes = getHighlightNodes(
        lowlight.highlight(detectedLanguage, textContent),
      );
    } else {
      nodes = getHighlightNodes(autoResult);
    }
  }

  parseNodes(nodes).forEach((node) => {
    const to = from + node.text.length;

    if (node.classes.length) {
      tokens.push({ from, to, class: node.classes.join(' ') });
    }

    from = to;
  });

  return tokens;
}

function getDecorations({
  doc,
  blocks,
  highlighted,
  lowlight,
  defaultLanguage,
}: {
  doc: ProsemirrorNode;
  blocks: NodeWithPos[];
  highlighted: WeakMap<ProsemirrorNode, Token[]>;
  lowlight: any;
  defaultLanguage: string | null | undefined;
}) {
  const decorations: Decoration[] = [];

  blocks.forEach((block) => {
    let tokens = highlighted.get(block.node);
    if (!tokens) {
      tokens = highlightBlock(block.node, lowlight, defaultLanguage);
      highlighted.set(block.node, tokens);
    }

    const start = block.pos + 1;
    tokens.forEach((token) => {
      decorations.push(
        Decoration.inline(start + token.from, start + token.to, {
          class: token.class,
        }),
      );
    });
  });

  return DecorationSet.create(doc, decorations);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function isFunction(param: any): param is Function {
  return typeof param === 'function';
}

export function LowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string;
  lowlight: any;
  defaultLanguage: string | null | undefined;
}) {
  if (
    !['highlight', 'highlightAuto', 'listLanguages'].every((api) =>
      isFunction(lowlight[api]),
    )
  ) {
    throw Error(
      'You should provide an instance of lowlight to use the code-block-lowlight extension',
    );
  }

  const findCodeBlocks = createFindChildren((node) => node.type.name === name);
  // highlighting is the slow part, and a code block node never changes
  const highlighted = new WeakMap<ProsemirrorNode, Token[]>();
  const decorate = (doc: ProsemirrorNode) =>
    getDecorations({
      doc,
      blocks: findCodeBlocks(doc),
      highlighted,
      lowlight,
      defaultLanguage,
    });

  const lowlightPlugin: Plugin<any> = new Plugin({
    key: new PluginKey('lowlight'),

    state: {
      init: (_, { doc }) => decorate(doc),
      apply: (transaction, decorationSet, oldState, newState) => {
        if (!transaction.docChanged) return decorationSet;

        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findCodeBlocks(oldState.doc);
        const newNodes = findCodeBlocks(newState.doc);

        if (
          transaction.docChanged &&
          // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step) => {
              // @ts-ignore
              return (
                // @ts-ignore
                step.from !== undefined &&
                // @ts-ignore
                step.to !== undefined &&
                oldNodes.some((node) => {
                  // @ts-ignore
                  return (
                    // @ts-ignore
                    node.pos >= step.from &&
                    // @ts-ignore
                    node.pos + node.node.nodeSize <= step.to
                  );
                })
              );
            }))
        ) {
          return decorate(transaction.doc);
        }

        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return lowlightPlugin.getState(state);
      },
    },
  });

  return lowlightPlugin;
}
