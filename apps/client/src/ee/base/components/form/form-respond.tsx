import { useEffect, useState } from "react";
import { Alert } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { isAxiosError } from "axios";
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
import { FormSkeleton } from "@/ee/base/components/form/form-skeleton";
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
  const {
    data: publicForm,
    dataUpdatedAt,
    isFetching,
    isPaused,
    hasValidatedData,
    isError,
    error,
    refetch,
  } = usePublicFormQuery(key ?? undefined);
  const submitMutation = useSubmitPublicFormMutation();
  const { users } = useReferenceStore(pageId);
  const [submissionError, setSubmissionError] = useState<{
    key: string | null;
    status: FormUnavailableStatus;
  } | null>(null);
  const unavailable =
    submissionError?.key === key ? submissionError.status : null;

  useEffect(() => {
    setSubmissionError(null);
  }, [key, dataUpdatedAt, isFetching]);

  const validating =
    shareLoading ||
    (!!key && (isFetching || isPaused || (!hasValidatedData && !isError)));
  const errorStatus = isAxiosError(error) ? error.response?.status : undefined;
  const accessError = errorStatus && [400, 401, 403, 404].includes(errorStatus);
  const form =
    key &&
    hasValidatedData &&
    !accessError &&
    !unavailable &&
    publicForm?.status === "open"
      ? publicForm
      : null;

  if (validating && !form) {
    return <FormSkeleton />;
  }

  if (unavailable) {
    return <FormStatus variant={unavailable} />;
  }

  if (form) {
    return (
      <>
        {validating ? (
          <FormSkeleton />
        ) : isError ? (
          <FormStatus variant="error" onRetry={() => refetch()} />
        ) : null}
        <div hidden={validating || isError} aria-busy={validating}>
          <FormFill
            key={key}
            form={form.form}
            respondent={form.respondent}
            users={form.users}
            mode="live"
            onSubmit={(answers, timeZone) =>
              submitMutation.mutateAsync({ key: key!, answers, timeZone })
            }
            onUnavailable={(status) => setSubmissionError({ key, status })}
          />
        </div>
      </>
    );
  }

  if (key && isError) {
    return (
      <FormStatus
        variant={
          errorStatus === 400 || errorStatus === 404
            ? "notFound"
            : errorStatus === 403
              ? "closed"
              : errorStatus === 401
                ? "signInRequired"
                : "error"
        }
        onRetry={() => refetch()}
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
