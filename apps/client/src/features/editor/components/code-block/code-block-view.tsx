import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Select } from "@mantine/core";
import { useState } from "react";
import classes from "./code-block.module.css";

export default function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes, extension, editor } = props;
  const { language } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  return (
    <NodeViewWrapper className="codeBlock">
      <Group justify="flex-end">
        <Select
          placeholder="Auto"
          checkIconPosition="right"
          data={extension.options.lowlight.listLanguages()}
          value={languageValue}
          onChange={changeLanguage}
          searchable
          style={{ maxWidth: "130px" }}
          classNames={{ input: classes.selectInput }}
          disabled={!editor.isEditable}
        />
      </Group>
      <pre spellCheck="false">
        <NodeViewContent as="code" className={`language-${language}`} />
      </pre>
    </NodeViewWrapper>
  );
}
