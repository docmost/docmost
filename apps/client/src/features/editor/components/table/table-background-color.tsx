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
  { name: "Default", color: "" },
  { name: "Blue", color: "#b4d5ff" },
  { name: "Green", color: "#acf5d2" },
  { name: "Yellow", color: "#fef1b4" },
  { name: "Red", color: "#ffbead" },
  { name: "Pink", color: "#ffc7fe" },
  { name: "Gray", color: "#eaecef" },
  { name: "Purple", color: "#c1b7f2" },
];

export const TableBackgroundColor: FC<TableBackgroundColorProps> = ({
  editor,
}) => {
  const { t } = useTranslation();
  const [opened, setOpened] = React.useState(false);

  const setTableCellBackground = (color: string, colorName: string) => {
    editor
      .chain()
      .focus()
      .updateAttributes("tableCell", { 
        backgroundColor: color || null,
        backgroundColorName: color ? colorName : null 
      })
      .updateAttributes("tableHeader", { 
        backgroundColor: color || null,
        backgroundColorName: color ? colorName : null 
      })
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
      width={200}
      position="bottom"
      opened={opened}
      onChange={setOpened}
      withArrow
      transitionProps={{ transition: "pop" }}
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
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
            }}
          >
            {TABLE_COLORS.map((item, index) => (
              <UnstyledButton
                key={index}
                onClick={() => setTableCellBackground(item.color, item.name)}
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
                        color:
                          item.color === "" || item.color.startsWith("#F")
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
