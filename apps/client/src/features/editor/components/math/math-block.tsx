import "katex/dist/katex.min.css";
import katex from "katex";
//import "katex/dist/contrib/mhchem.min.js";
import { useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Flex, Popover, Stack, Textarea } from "@mantine/core";
import classes from "./math.module.css";
import { v4 } from "uuid";
import { IconTrashX } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";

export default function MathBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, editor, getPos } = props;
  const mathResultContainer = useRef<HTMLDivElement>(null);
  const mathPreviewContainer = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [debouncedPreview] = useDebouncedValue(preview, 500);

  const renderMath = (
    katexString: string,
    container: HTMLDivElement | null,
  ) => {
    try {
      katex.render(katexString, container!, {
        displayMode: true,
        strict: false,
      });
      setError(null);
    } catch (e) {
      //console.error(e.message);
      setError(e.message);
    }
  };

  useEffect(() => {
    renderMath(node.attrs.text, mathResultContainer.current);
  }, [node.attrs.text]);

  useEffect(() => {
    if (isEditing) {
      renderMath(preview || "", mathPreviewContainer.current);
    }
  }, [preview, isEditing]);

  useEffect(() => {
    if (debouncedPreview !== null) {
      queueMicrotask(() => {
        updateAttributes({ text: debouncedPreview });
      });
    }
  }, [debouncedPreview]);

  useEffect(() => {
    setIsEditing(!!props.selected);
    if (props.selected) setPreview(node.attrs.text);
  }, [props.selected]);

  return (
    <Popover
      opened={isEditing && editor.isEditable}
      trapFocus
      position="top"
      shadow="md"
      width={500}
      withArrow={true}
      zIndex={101}
      id={v4()}
    >
      <Popover.Target>
        <NodeViewWrapper
          data-katex="true"
          className={[
            classes.mathBlock,
            props.selected ? classes.selected : "",
            error ? classes.error : "",
            (isEditing && !preview?.trim().length) ||
            (!isEditing && !node.attrs.text.trim().length)
              ? classes.empty
              : "",
          ].join(" ")}
        >
          <div
            style={{
              display: isEditing && preview?.length ? undefined : "none",
            }}
            ref={mathPreviewContainer}
          ></div>
          <div
            style={{ display: isEditing ? "none" : undefined }}
            ref={mathResultContainer}
          ></div>
          {((isEditing && !preview?.trim().length) ||
            (!isEditing && !node.attrs.text.trim().length)) && (
            <div>{t("Empty equation")}</div>
          )}
          {error && <div>{t("Invalid equation")}</div>}
        </NodeViewWrapper>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack>
          <Textarea
            minRows={4}
            maxRows={8}
            autosize
            ref={textAreaRef}
            draggable="false"
            value={preview ?? ""}
            placeholder={"E = mc^2"}
            classNames={{ input: classes.textInput }}
            onBlur={(e) => {
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
                return editor.commands.focus(getPos() + node.nodeSize);
              }

              if (!textAreaRef.current) return;

              const { selectionStart, selectionEnd } = textAreaRef.current;

              if (
                (e.key === "ArrowLeft" || e.key === "ArrowUp") &&
                selectionStart === selectionEnd &&
                selectionStart === 0
              ) {
                editor.commands.focus(getPos() - 1);
              }

              if (
                (e.key === "ArrowRight" || e.key === "ArrowDown") &&
                selectionStart === selectionEnd &&
                selectionStart === textAreaRef.current?.value.length
              ) {
                editor.commands.focus(getPos() + node.nodeSize);
              }
            }}
            onChange={(e) => {
              setPreview(e.target.value);
            }}
          ></Textarea>

          <Flex justify="flex-end" align="flex-end">
            <ActionIcon variant="light" color="red">
              <IconTrashX size={18} onClick={() => props.deleteNode()} />
            </ActionIcon>
          </Flex>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
