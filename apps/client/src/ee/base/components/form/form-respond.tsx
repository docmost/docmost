import { useState } from "react";
import { Alert, Loader, Stack } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBaseView, PublicForm } from "@/ee/base/types/base.types";
import {
  useFormShareQuery,
  usePublicFormQuery,
  useSubmitPublicFormMutation,
} from "@/ee/base/queries/base-form-query";
import { useReferenceStore } from "@/ee/base/reference/reference-store";
import {
  FormFill,
  FormUnavailableStatus,
} from "@/ee/base/components/form/form-fill";
import { FormStatus } from "@/ee/base/components/form/form-status";
import classes from "@/ee/base/styles/form.module.css";

type FormRespondProps = {
  view: IBaseView;
  pageId: string;
  definition: PublicForm;
};

export function FormRespond({ view, pageId, definition }: FormRespondProps) {
  const { t } = useTranslation();
  const { data: share, isLoading: shareLoading } = useFormShareQuery(
    pageId,
    view.id,
  );
  const key = share && share.access !== "none" ? share.key : null;
  const { data: publicForm, isLoading: formLoading } = usePublicFormQuery(
    key ?? undefined,
  );
  const submitMutation = useSubmitPublicFormMutation();
  const { users } = useReferenceStore(pageId);
  const [unavailable, setUnavailable] =
    useState<FormUnavailableStatus | null>(null);

  if (shareLoading || (key && formLoading)) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (unavailable) {
    return <FormStatus variant={unavailable} />;
  }

  if (key && publicForm?.status === "open") {
    return (
      <FormFill
        form={publicForm.form}
        respondent={publicForm.respondent}
        users={publicForm.users}
        mode="live"
        onSubmit={(answers) => submitMutation.mutateAsync({ key, answers })}
        onUnavailable={setUnavailable}
      />
    );
  }

  return (
    <>
      <Alert
        variant="light"
        color="gray"
        icon={<IconLock size={16} />}
        className={classes.notice}
      >
        {t("This form isn't accepting responses.")}
      </Alert>
      <FormFill form={definition} mode="readOnly" users={users} />
    </>
  );
}
