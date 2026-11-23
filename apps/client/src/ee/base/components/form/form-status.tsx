import { Button, Text, ThemeIcon } from "@mantine/core";
import {
  IconAlertTriangle,
  IconFileOff,
  IconLock,
  IconLogin2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "@/ee/base/styles/form.module.css";

export type FormStatusVariant =
  | "closed"
  | "signInRequired"
  | "notFound"
  | "error";

type FormStatusProps = {
  variant: FormStatusVariant;
  workspaceName?: string;
  onSignIn?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export function FormStatus({
  variant,
  workspaceName,
  onSignIn,
  onRetry,
  retrying,
}: FormStatusProps) {
  const { t } = useTranslation();

  const content = {
    closed: {
      icon: IconLock,
      title: t("This form is closed"),
      message: t("It's no longer accepting responses."),
    },
    signInRequired: {
      icon: IconLogin2,
      title: t("Sign in to fill out this form"),
      message: workspaceName
        ? t("Only members of {{workspace}} can respond to this form.", {
            workspace: workspaceName,
          })
        : t("Only workspace members can respond to this form."),
    },
    notFound: {
      icon: IconFileOff,
      title: t("Form not found"),
      message: t("This form doesn't exist or is no longer available."),
    },
    error: {
      icon: IconAlertTriangle,
      title: t("Something went wrong"),
      message: t("We couldn't load this form."),
    },
  }[variant];

  const Icon = content.icon;

  return (
    <div className={classes.status}>
      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
        <Icon size={28} stroke={1.5} />
      </ThemeIcon>
      <h2 className={classes.statusTitle}>{content.title}</h2>
      <Text c="dimmed">{content.message}</Text>
      {variant === "signInRequired" && onSignIn && (
        <Button onClick={onSignIn}>{t("Sign in")}</Button>
      )}
      {variant === "error" && onRetry && (
        <Button variant="default" loading={retrying} onClick={onRetry}>
          {t("Try again")}
        </Button>
      )}
    </div>
  );
}
