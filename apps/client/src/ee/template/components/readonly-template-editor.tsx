import "@/features/editor/styles/index.css";
import { useMemo } from "react";
import { Title } from "@mantine/core";
import { EditorProvider } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { UniqueID } from "@docmost/editor-ext";
import { ITemplate } from "@/ee/template/types/template.types";
import TemplateMeta from "@/ee/template/components/template-meta";
import { TemplateSkeleton } from "@/ee/template/extensions/template-skeleton/template-skeleton-extension";
import TemplateSkeletonView from "@/ee/template/extensions/template-skeleton/template-skeleton-view";

type ReadonlyTemplateEditorProps = {
  template: ITemplate;
};

export default function ReadonlyTemplateEditor({
  template,
}: ReadonlyTemplateEditorProps) {
  const extensions = useMemo(() => {
    const filteredExtensions = mainExtensions.filter(
      (ext) => ext.name !== "uniqueID",
    );

    return [
      ...filteredExtensions,
      UniqueID.configure({
        types: ["heading", "paragraph"],
        updateDocument: false,
      }),
      TemplateSkeleton.configure({ view: TemplateSkeletonView }),
    ];
  }, []);

  return (
    <>
      <div style={{ padding: "0 3rem" }}>
        <Title order={1} size="2.5rem" lh={1.2}>
          {template.title || "Untitled"}
        </Title>

        <TemplateMeta template={template} />
      </div>

      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={extensions}
        content={template.content}
      />
    </>
  );
}
