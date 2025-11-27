import { Editor as CoreEditor } from "@tiptap/core";
import { TableOfContentsStorage } from "@tiptap/extension-table-of-contents";
import { NodeViewWrapper, useEditorState } from "@tiptap/react";
import { memo } from "react";
import classes from "./table-of-contents-nodeview.module.css";
import { useTranslation } from "react-i18next";
import { TextSelection } from "@tiptap/pm/state";

export type TableOfContentsProps = {
  editor: CoreEditor;
};

export const TableOfContentsNodeview = memo(
  ({ editor }: TableOfContentsProps) => {
    const content = useEditorState({
      editor,
      selector: (ctx) =>
        (ctx.editor.storage.tableOfContents as TableOfContentsStorage)?.content,
    });
    const { t } = useTranslation();

    const onTocItemClick = (e, id) => {
      e.preventDefault();

      if (editor) {
        const element = editor.view.dom.querySelector(`[data-toc-id="${id}"`);
        const pos = editor.view.posAtDOM(element, 0);

        // set focus
        const tr = editor.view.state.tr;

        tr.setSelection(new TextSelection(tr.doc.resolve(pos)));

        editor.view.dispatch(tr);

        editor.view.focus();

        if (history.pushState) {
          history.pushState(null, null, `#${id}`);
        }

        window.scrollTo({
          top: element.getBoundingClientRect().top + window.scrollY,
          behavior: "smooth",
        });
      }
    };

    return (
      <NodeViewWrapper>
        <div contentEditable={false}>
          {content.length > 0 ? (
            <div className={classes.container}>
              {content
                .filter((item) => item.level <= 4)
                .map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    style={{ "--level": item.level } as React.CSSProperties}
                    onClick={(e) => onTocItemClick(e, item.id)}
                    className={classes.link}
                    data-item-index={item.itemIndex}
                    draggable="false"
                  >
                    {item.textContent}
                  </a>
                ))}
            </div>
          ) : (
            <div className={classes.emptyState}>
              {t("No table of contents yet")}
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  },
);

TableOfContentsNodeview.displayName = "TableOfContentsNodeview";
