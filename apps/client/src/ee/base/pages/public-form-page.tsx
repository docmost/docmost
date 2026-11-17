import "@fontsource-variable/inter";
import "@/styles/public-typography.css";
import { ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { isAxiosError } from "axios";
import clsx from "clsx";
import { DocumentTitle } from "@/components/ui/document-title";
import APP_ROUTE from "@/lib/app-route";
import {
  usePublicFormQuery,
  useSubmitPublicFormMutation,
} from "@/ee/base/queries/base-form-query";
import {
  FormFill,
  FormUnavailableStatus,
} from "@/ee/base/components/form/form-fill";
import { FormSkeleton } from "@/ee/base/components/form/form-skeleton";
import { FormStatus } from "@/ee/base/components/form/form-status";
import classes from "@/ee/base/styles/public-form.module.css";

export default function PublicFormPage() {
  const { t } = useTranslation();
  const { formKey } = useParams();
  const {
    data,
    dataUpdatedAt,
    isFetching,
    isPaused,
    hasValidatedData,
    isError,
    error,
    refetch,
  } = usePublicFormQuery(formKey);
  const submitMutation = useSubmitPublicFormMutation();
  const [submissionError, setSubmissionError] = useState<{
    key: string | undefined;
    status: FormUnavailableStatus;
  } | null>(null);
  const unavailable =
    submissionError && submissionError.key === formKey
      ? submissionError.status
      : null;

  useEffect(() => {
    setSubmissionError(null);
  }, [formKey, dataUpdatedAt, isFetching]);

  const signIn = () => {
    const params = new URLSearchParams({ redirect: `/forms/${formKey}` });
    window.location.href = `${APP_ROUTE.AUTH.LOGIN}?${params.toString()}`;
  };

  const errorStatus = isAxiosError(error) ? error.response?.status : undefined;
  const validating =
    isFetching || isPaused || (!!formKey && !hasValidatedData && !isError);
  const accessError = errorStatus && [400, 401, 403, 404].includes(errorStatus);
  const form =
    hasValidatedData && !accessError && !unavailable && data?.status === "open"
      ? data
      : null;

  let content: ReactNode;
  if (validating) {
    content = <FormSkeleton />;
  } else if (unavailable) {
    content = <FormStatus variant={unavailable} onSignIn={signIn} />;
  } else if (isError || !data) {
    content =
      errorStatus === 400 || errorStatus === 404 ? (
        <FormStatus variant="notFound" />
      ) : errorStatus === 403 ? (
        <FormStatus variant="closed" />
      ) : errorStatus === 401 ? (
        <FormStatus variant="signInRequired" onSignIn={signIn} />
      ) : (
        <FormStatus
          variant="error"
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      );
  } else if (data.status === "closed") {
    content = <FormStatus variant="closed" />;
  } else if (data.status === "signInRequired") {
    content = (
      <FormStatus
        variant="signInRequired"
        workspaceName={data.workspaceName}
        onSignIn={signIn}
      />
    );
  } else {
    content = null;
  }

  const title =
    form && !validating && !isError
      ? form.form.title || t("Untitled form")
      : t("Form");

  return (
    <div className={clsx(classes.page, "public-typography")}>
      <DocumentTitle title={title} withAppName={false}>
        <meta name="robots" content="noindex" />
      </DocumentTitle>

      <header className={classes.topBar}>
        <ColorSchemeToggle />
      </header>

      <main className={classes.main} aria-busy={validating}>
        {content}
        {form && (
          // Keep an existing draft mounted while its schema is checked again.
          <div hidden={validating || isError}>
            <FormFill
              key={formKey}
              form={form.form}
              respondent={form.respondent}
              users={form.users}
              mode="live"
              onSubmit={(answers, timeZone) =>
                submitMutation.mutateAsync({ key: formKey!, answers, timeZone })
              }
              onUnavailable={(status) =>
                setSubmissionError({ key: formKey, status })
              }
            />
          </div>
        )}
      </main>

      <footer className={classes.footer}>
        <Text size="xs" c="dimmed">
          {t(
            "Never submit passwords or other sensitive information through this form.",
          )}
        </Text>
        <a
          className={classes.branding}
          href="https://docmost.com?ref=public-form"
          target="_blank"
          rel="noreferrer"
        >
          Powered by Docmost
        </a>
      </footer>
    </div>
  );
}

function ColorSchemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");
  const label = t("Toggle color scheme");

  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={label}
        onClick={() =>
          setColorScheme(computedColorScheme === "light" ? "dark" : "light")
        }
      >
        {computedColorScheme === "light" ? (
          <IconMoon size={18} stroke={1.75} />
        ) : (
          <IconSun size={18} stroke={1.75} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
