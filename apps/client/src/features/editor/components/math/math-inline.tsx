import "katex/dist/katex.min.css";
import katex from "katex";
//import "katex/dist/contrib/mhchem.min.js";
import { useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, Textarea } from "@mantine/core";
import classes from "./math.module.css";
import { v4 } from "uuid";

export default function MathInlineView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const mathResultContainer = useRef<HTMLDivElement>(null);
  const mathPreviewContainer = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const renderMath = (
    katexString: string,
    container: HTMLDivElement | null,
  ) => {
    try {
      katex.render(katexString, container);
      setError(null);
    } catch (e) {
      //console.error(e);
      setError(e.message);
    }
  };

  useEffect(() => {
    renderMath(node.attrs.katex, mathResultContainer.current);
  }, [node.attrs.katex]);

  useEffect(() => {
    if (isEditing) {
      renderMath(preview || "", mathPreviewContainer.current);
    } else if (preview !== null) {
      queueMicrotask(() => {
        updateAttributes({ katex: preview });
      });
    }
  }, [preview, isEditing]);

  useEffect(() => {
    setIsEditing(!!props.selected);
    if (props.selected) setPreview(node.attrs.katex);
  }, [props.selected]);

  return (
    <>
      <Popover
        opened={isEditing && editor.isEditable}
        trapFocus
        position="top"
        shadow="md"
        width={400}
        middlewares={{ flip: true, shift: true, inline: true }}
        withArrow={true}
        zIndex={101}
        id={v4()}
      >
        <Popover.Target>
          <NodeViewWrapper
            data-katex="true"
            className={[
              classes.mathInline,
              props.selected ? classes.selected : "",
              error ? classes.error : "",
              (isEditing && !preview?.trim().length) ||
              (!isEditing && !node.attrs.katex.trim().length)
                ? classes.empty
                : "",
            ].join(" ")}
          >
            <div
              style={{ display: isEditing ? undefined : "none" }}
              ref={mathPreviewContainer}
            ></div>
            <div
              style={{ display: isEditing ? "none" : undefined }}
              ref={mathResultContainer}
            ></div>
            {((isEditing && !preview?.trim().length) ||
              (!isEditing && !node.attrs.katex.trim().length)) && (
              <div>Empty equation</div>
            )}
            {error && <div>Invalid equation</div>}
          </NodeViewWrapper>
        </Popover.Target>
        <Popover.Dropdown p={"xs"}>
          <Textarea
            minRows={1}
            maxRows={5}
            autosize
            ref={textAreaRef}
            draggable={false}
            classNames={{ input: classes.textInput }}
            value={preview?.trim() ?? ""}
            placeholder={"E = mc^2"}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
                return editor.commands.focus(getPos() + node.nodeSize);
              }

              if (!textAreaRef.current) return;

              const { selectionStart, selectionEnd } = textAreaRef.current;

              if (
                e.key === "ArrowLeft" &&
                selectionStart === selectionEnd &&
                selectionStart === 0
              ) {
                editor.commands.focus(getPos());
              }

              if (
                e.key === "ArrowRight" &&
                selectionStart === selectionEnd &&
                selectionStart === textAreaRef.current.value.length
              ) {
                editor.commands.focus(getPos() + node.nodeSize);
              }
            }}
            onChange={(e) => {
              setPreview(e.target.value);
            }}
          />
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
