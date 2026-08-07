import { Anchor, Text, TextProps } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props extends TextProps {
  /** the action the user is trying to do, e.g. "preview" | "search" | "create" */
  action: string;
}

// Dimmed prompt with a settings link, shown when the viewer hasn't connected Linear.
export default function LinearConnectPrompt({ action, ...props }: Props) {
  const { t } = useTranslation();

  return (
    <Text size="sm" c="dimmed" {...props}>
      <Anchor component={Link} to="/settings/integrations" inherit>
        {t("Connect Linear in settings")}
      </Anchor>{" "}
      {t("to {{action}} issues.", { action })}
    </Text>
  );
}
