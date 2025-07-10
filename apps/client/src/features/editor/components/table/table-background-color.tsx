import React, { FC } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import {
  ActionIcon,
  ColorSwatch,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

export interface TableColorItem {
  name: string;
  color: string;
}

interface TableBackgroundColorProps {
  editor: ReturnType<typeof useEditor>;
}

const TABLE_COLORS: TableColorItem[] = [
  // First row - grays
  { name: "Default", color: "" },
  { name: "Light blue", color: "#E6E9FF" },
  { name: "Light cyan", color: "#E0F2FE" },
  { name: "Light teal", color: "#CCFBF1" },
  { name: "Light yellow", color: "#FEF3C7" },
  { name: "Light pink", color: "#FCE7F3" },
  { name: "Light purple", color: "#EDE9FE" },

  // Second row - light colors
  { name: "Gray", color: "#F3F4F6" },
  { name: "Blue", color: "#BFDBFE" },
  { name: "Cyan", color: "#A5F3FC" },
  { name: "Teal", color: "#99F6E4" },
  { name: "Yellow", color: "#FDE68A" },
  { name: "Pink", color: "#FBCFE8" },
  { name: "Purple", color: "#DDD6FE" },
  
  // Third row - bold colors
  { name: "Dark gray", color: "#9CA3AF" },
  { name: "Bold blue", color: "#60A5FA" },
  { name: "Bold cyan", color: "#22D3EE" },
  { name: "Bold teal", color: "#2DD4BF" },
  { name: "Bold orange", color: "#FB923C" },
  { name: "Bold red", color: "#F87171" },
  { name: "Bold purple", color: "#A78BFA" },
];

export const TableBackgroundColor: FC<TableBackgroundColorProps> = ({
  editor,
}) => {
  const { t } = useTranslation();
  const [opened, setOpened] = React.useState(false);

  const setTableCellBackground = (color: string) => {
    editor
      .chain()
      .focus()
      .updateAttributes("tableCell", { backgroundColor: color || null })
      .updateAttributes("tableHeader", { backgroundColor: color || null })
      .run();
    setOpened(false);
  };

  // Get current cell's background color
  const getCurrentColor = () => {
    if (editor.isActive("tableCell")) {
      const attrs = editor.getAttributes("tableCell");
      return attrs.backgroundColor || "";
    }
    if (editor.isActive("tableHeader")) {
      const attrs = editor.getAttributes("tableHeader");
      return attrs.backgroundColor || "";
    }
    return "";
  };

  const currentColor = getCurrentColor();

  return (
    <Popover 
      width={280} 
      position="bottom" 
      opened={opened} 
      onChange={setOpened}
      withArrow
      transitionProps={{ transition: 'pop' }}
    >
      <Popover.Target>
        <Tooltip label={t("Background color")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t("Background color")}
            onClick={() => setOpened(!opened)}
          >
            <IconPalette size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {t("Background color")}
          </Text>
          
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "8px",
            }}
          >
            {TABLE_COLORS.map((item, index) => (
              <UnstyledButton
                key={index}
                onClick={() => setTableCellBackground(item.color)}
                style={{
                  position: "relative",
                  width: "24px",
                  height: "24px",
                }}
                title={t(item.name)}
              >
                <ColorSwatch
                  color={item.color || "#ffffff"}
                  size={24}
                  style={{
                    border: item.color === "" ? "1px solid #e5e7eb" : undefined,
                    cursor: "pointer",
                  }}
                >
                  {currentColor === item.color && (
                    <IconCheck
                      size={18}
                      style={{
                        color: item.color === "" || item.color.startsWith("#F") 
                          ? "#000000" 
                          : "#ffffff",
                      }}
                    />
                  )}
                </ColorSwatch>
              </UnstyledButton>
            ))}
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};