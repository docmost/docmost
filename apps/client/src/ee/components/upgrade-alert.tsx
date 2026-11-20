import { Alert, Anchor, type AlertProps } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { Trans } from "react-i18next";

type UpgradeAlertProps = {
  message: string;
} & Pick<AlertProps, "mb">;

export function UpgradeAlert({ message, mb }: UpgradeAlertProps) {
  return (
    <Alert
      icon={<IconInfoCircle size={16} />}
      color="blue"
      variant="light"
      mb={mb}
    >
      {message}{" "}
      <Trans
        i18nKey="Contact <anchor>sales@docmost.com</anchor>."
        components={{
          anchor: <Anchor href="mailto:sales@docmost.com" inherit />,
        }}
      />
    </Alert>
  );
}
