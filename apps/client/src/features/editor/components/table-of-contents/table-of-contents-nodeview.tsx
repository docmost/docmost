import { Editor as CoreEditor } from "@tiptap/core";
import { TableOfContentsStorage } from "@tiptap/extension-table-of-contents";
import { NodeViewWrapper, useEditorState } from "@tiptap/react";
import { memo } from "react";
import { clsx } from "clsx";
import classes from "./table-of-contents-nodeview.module.css";

export type TableOfContentsProps = {
  editor: CoreEditor;
  onItemClick?: () => void;
};

export const TableOfContentsNodeview = memo(
  ({ editor, onItemClick }: TableOfContentsProps) => {
    const content = useEditorState({
      editor,
      selector: (ctx) =>
        (ctx.editor.storage.tableOfContents as TableOfContentsStorage)?.content,
    });

    return (
      <NodeViewWrapper>
        <div contentEditable={false}>
          <div className={classes.header}>Table of contents</div>
          {content.length > 0 ? (
            <div className={classes.container}>
              {content.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  style={{ marginLeft: `${1 * item.level - 1}rem` }}
                  onClick={onItemClick}
                  className={clsx(
                    classes.link,
                    item.isActive && classes.linkActive,
                  )}
                >
                  {item.itemIndex}. {item.textContent}
                </a>
              ))}
            </div>
          ) : (
            <div className={classes.emptyState}>
              Start adding headlines to your document …
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  },
);

TableOfContentsNodeview.displayName = "TableOfContentsNodeview";
