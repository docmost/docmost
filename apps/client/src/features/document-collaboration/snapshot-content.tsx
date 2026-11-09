import { Fragment, ReactNode } from "react";
import { Paper, Text, Title } from "@mantine/core";
import { Snapshot } from "./collaboration-api";
import classes from "./collaboration.module.css";

// Render only stored content. Embedded pages and remote resources are never fetched.
function renderNode(node: any, key: string): ReactNode {
  if (!node || typeof node !== "object") return null;
  const children = Array.isArray(node.content)
    ? node.content.map((n: any, i: number) => renderNode(n, `${key}-${i}`))
    : null;
  if (node.type === "text") {
    let text: ReactNode = node.text || "";
    for (const mark of node.marks || []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "strike") text = <s>{text}</s>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "code") text = <code>{text}</code>;
      if (
        mark.type === "link" &&
        /^(https?:|mailto:)/i.test(mark.attrs?.href || "")
      )
        text = (
          <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
        );
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  switch (node.type) {
    case "doc":
      return <Fragment key={key}>{children}</Fragment>;
    case "paragraph":
      return <p key={key}>{children || <br />}</p>;
    case "heading": {
      const level = Number(node.attrs?.level || 2);
      return level === 1 ? (
        <h2 key={key}>{children}</h2>
      ) : level === 2 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h4 key={key}>{children}</h4>
      );
    }
    case "bulletList":
    case "taskList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={node.attrs?.start || 1}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "taskItem":
      return (
        <li key={key}>
          {node.attrs?.checked ? "☑ " : "☐ "}
          {children}
        </li>
      );
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "table":
      return (
        <table key={key}>
          <tbody>{children}</tbody>
        </table>
      );
    case "tableRow":
      return <tr key={key}>{children}</tr>;
    case "tableHeader":
      return (
        <th
          key={key}
          colSpan={node.attrs?.colspan || 1}
          rowSpan={node.attrs?.rowspan || 1}
        >
          {children}
        </th>
      );
    case "tableCell":
      return (
        <td
          key={key}
          colSpan={node.attrs?.colspan || 1}
          rowSpan={node.attrs?.rowspan || 1}
        >
          {children}
        </td>
      );
    case "mention":
      return (
        <span key={key}>
          @{node.attrs?.label || node.attrs?.name || "成员"}
        </span>
      );
    case "callout":
      return <blockquote key={key}>{children}</blockquote>;
    case "image":
    case "attachment":
    case "video":
    case "audio":
    case "embed":
    case "drawio":
    case "excalidraw":
    case "mermaid":
    case "transclusion":
      return (
        <div key={key} className={classes.omitted}>
          〔{node.type}：附件或嵌入内容不在本批次正文确认范围内〕
        </div>
      );
    default:
      return (
        <div key={key}>
          {children || (
            <span className={classes.omitted}>
              〔{node.type || "特殊内容"}：请另行核对源文档〕
            </span>
          )}
        </div>
      );
  }
}
export function SnapshotContent({ snapshot }: { snapshot: Snapshot }) {
  return (
    <Paper withBorder p="lg" className={classes.snapshot}>
      <Title order={3} mb="md">
        {snapshot.title}
      </Title>
      {snapshot.content ? (
        renderNode(snapshot.content, "root")
      ) : (
        <Text style={{ whiteSpace: "pre-wrap" }}>
          {snapshot.textContent || "（正文为空）"}
        </Text>
      )}
    </Paper>
  );
}
