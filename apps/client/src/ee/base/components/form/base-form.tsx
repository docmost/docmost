import { useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { formPreviewAtomFamily } from "@/ee/base/atoms/base-atoms";
import { useSubmitFormPreviewMutation } from "@/ee/base/queries/base-form-query";
import { useReferenceStore } from "@/ee/base/reference/reference-store";
import { usePageQuery } from "@/features/page/queries/page-query";
import { buildFormDefinition } from "@/ee/base/components/form/form-definition";
import { FormBuilder } from "@/ee/base/components/form/form-builder";
import { FormFill } from "@/ee/base/components/form/form-fill";
import { FormRespond } from "@/ee/base/components/form/form-respond";
import classes from "@/ee/base/styles/form.module.css";

type BaseFormProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  editable: boolean;
  embedded?: boolean;
};

export function BaseForm({
  base,
  view,
  pageId,
  editable,
  embedded,
}: BaseFormProps) {
  const [preview, setPreview] = useAtom(formPreviewAtomFamily(view.id));
  const { users } = useReferenceStore(pageId);
  const { data: page } = usePageQuery({ pageId });
  const submitPreview = useSubmitFormPreviewMutation();

  useEffect(() => () => setPreview(false), [setPreview]);

  const definition = useMemo(
    () => buildFormDefinition(view.config?.form, base.properties, page?.title),
    [view.config?.form, base.properties, page?.title],
  );

  let content;
  if (!editable) {
    content = (
      <FormRespond view={view} pageId={pageId} definition={definition} />
    );
  } else if (preview) {
    content = (
      <FormFill
        form={definition}
        mode="preview"
        users={users}
        onSubmit={(answers) =>
          submitPreview.mutateAsync({ pageId, viewId: view.id, answers })
        }
        onExitPreview={() => setPreview(false)}
      />
    );
  } else {
    content = (
      <FormBuilder
        base={base}
        view={view}
        pageId={pageId}
        pageTitle={page?.title}
        users={users}
      />
    );
  }

  return (
    <div className={classes.canvas} data-embedded={embedded || undefined}>
      {content}
    </div>
  );
}
