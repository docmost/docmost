import "@fontsource-variable/inter";
import "@/styles/public-typography.css";
import { ReactNode, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Skeleton,
  Stack,
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
import { FormStatus } from "@/ee/base/components/form/form-status";
import classes from "@/ee/base/styles/public-form.module.css";

export default function PublicFormPage() {
  const { t } = useTranslation();
  const { formKey } = useParams();
  const { data, isLoading, isFetching, isError, error, refetch } =
    usePublicFormQuery(formKey);
  const submitMutation = useSubmitPublicFormMutation();
  const [unavailable, setUnavailable] =
    useState<FormUnavailableStatus | null>(null);

  const signIn = () => {
    const params = new URLSearchParams({ redirect: `/forms/${formKey}` });
    window.location.href = `${APP_ROUTE.AUTH.LOGIN}?${params.toString()}`;
  };

  const errorStatus = isAxiosError(error) ? error.response?.status : undefined;

  let content: ReactNode;
  if (isLoading) {
    content = <PublicFormSkeleton />;
  } else if (unavailable) {
    content = <FormStatus variant={unavailable} onSignIn={signIn} />;
  } else if (isError || !data) {
    content =
      errorStatus === 400 || errorStatus === 404 ? (
        <FormStatus variant="notFound" />
      ) : errorStatus === 403 ? (
        <FormStatus variant="closed" />
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
    content = (
      <FormFill
        form={data.form}
        respondent={data.respondent}
        users={data.users}
        mode="live"
        onSubmit={(answers) =>
          submitMutation.mutateAsync({ key: formKey!, answers })
        }
        onUnavailable={setUnavailable}
      />
    );
  }

  const title =
    data?.status === "open" ? data.form.title || t("Untitled form") : t("Form");

  return (
    <div className={clsx(classes.page, "public-typography")}>
      <DocumentTitle title={title} withAppName={false}>
        <meta name="robots" content="noindex" />
      </DocumentTitle>

      <header className={classes.topBar}>
        <ColorSchemeToggle />
      </header>

      <main className={classes.main}>{content}</main>

      <footer className={classes.footer}>
        <Text size="xs" c="dimmed">
          {t("Never submit passwords or other sensitive information through this form.")}
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

function PublicFormSkeleton() {
  return (
    <Stack gap="md" aria-hidden>
      <Skeleton height={40} width="60%" radius="sm" />
      <Skeleton height={14} width="90%" radius="sm" mt={8} />
      <Skeleton height={14} width="70%" radius="sm" />
      <Skeleton height={22} width="45%" radius="sm" mt={32} />
      <Skeleton height={42} radius="md" />
      <Skeleton height={22} width="35%" radius="sm" mt={24} />
      <Skeleton height={42} radius="md" />
    </Stack>
  );
}
