import "@/features/editor/styles/index.css";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Title } from "@mantine/core";
import { EditorProvider } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { UniqueID } from "@docmost/editor-ext";
import { TemplateVariableWithChip } from "./template-variable-node";
import { useExportDisabled } from "@/ee/security/hooks/use-export-disabled";
import { useDisablePrint } from "@/ee/security/hooks/use-disable-print";
import "./template-variable.css";
import { ITemplate } from "@/ee/template/types/template.types";
import TemplateMeta from "@/ee/template/components/template-meta";
import classes from "./readonly-template-editor.module.css";

const editorProps = {
  attributes: { role: "document", class: "template-preview" },
};

type ReadonlyTemplateEditorProps = {
  template: ITemplate;
  variableNode?: typeof TemplateVariableWithChip;
};

export default function ReadonlyTemplateEditor({
  template,
  variableNode = TemplateVariableWithChip,
}: ReadonlyTemplateEditorProps) {
  const { t } = useTranslation();
  const { exportDisabledLabel } = useExportDisabled(template.spaceId);
  useDisablePrint(exportDisabledLabel);

  const extensions = useMemo(() => {
    const filteredExtensions = mainExtensions.filter(
      (ext) => ext.name !== "uniqueID",
    );

    return [
      ...filteredExtensions,
      variableNode,
      UniqueID.configure({
        types: ["heading", "paragraph"],
        updateDocument: false,
      }),
    ];
  }, [variableNode]);

  return (
    <>
      <div className={classes.titleArea}>
        <Title order={1} size="2.5rem" lh={1.2}>
          {template.title || t("Untitled")}
        </Title>

        <TemplateMeta template={template} />
      </div>

      <EditorProvider
        editable={false}
        immediatelyRender={true}
        textDirection="auto"
        editorProps={editorProps}
        extensions={extensions}
        content={template.content}
      />
    </>
  );
}
