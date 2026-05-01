import { FC } from "react";
import { IconLink } from "@tabler/icons-react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { showLinkMenuAtom } from "@/features/editor/atoms/editor-atoms";

export const LinkSelector: FC = () => {
  const { t } = useTranslation();
  const setShowLinkMenu = useSetAtom(showLinkMenuAtom);

  return (
    <Tooltip label={t("Add link")} withArrow>
      <ActionIcon
        variant="default"
        size="lg"
        radius="0"
        style={{ border: "none" }}
        onClick={() => setShowLinkMenu(true)}
      >
        <IconLink size={16} />
      </ActionIcon>
    </Tooltip>
  );
};
