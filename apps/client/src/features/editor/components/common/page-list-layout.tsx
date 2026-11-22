import type { ReactNode } from "react";
import { ActionIcon } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useEditorState, type NodeViewProps } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import classes from "./page-list.module.css";

const subheadings = ["h2", "h3", "h4", "h5", "h6", "h6"] as const;

function headingTagAt(doc: ProseMirrorNode, pos: number | undefined) {
  if (pos == null || pos > doc.content.size) return "h2";
  const $pos = doc.resolve(pos);
  // Only headings in this container or its ancestors introduce the report.
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const parent = $pos.node(depth);
    for (let i = $pos.index(depth) - 1; i >= 0; i--) {
      const sibling = parent.child(i);
      if (sibling.type.name === "heading") {
        return subheadings[sibling.attrs.level - 1] ?? "h2";
      }
    }
  }
  return "h2";
}

export function PageListHeading({
  editor,
  getPos,
  id,
  children,
}: Pick<NodeViewProps, "editor" | "getPos"> & {
  id?: string;
  children: ReactNode;
}) {
  const Tag = useEditorState({
    editor,
    selector: ({ editor }) => headingTagAt(editor.state.doc, getPos()),
  });
  return (
    <Tag id={id} className={classes.heading}>
      {children}
    </Tag>
  );
}

export function PageListRefreshButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      aria-label={label}
      title={label}
      loading={loading}
      onClick={onClick}
    >
      <IconRefresh size={16} />
    </ActionIcon>
  );
}

interface PageListLayoutProps {
  heading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageListLayout({
  heading,
  actions,
  children,
}: PageListLayoutProps) {
  const toolbar = actions && (
    <div className={classes.actions + " print-hide"}>{actions}</div>
  );
  return (
    <div className={heading ? undefined : classes.headless}>
      {heading ? (
        <div className={classes.header}>
          {heading}
          {toolbar}
        </div>
      ) : (
        toolbar
      )}
      <div className={classes.content}>{children}</div>
    </div>
  );
}
