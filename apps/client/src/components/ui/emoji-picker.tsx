import React, { ReactNode, useState } from "react";
import {
  ActionIcon,
  Popover,
  Button,
  useMantineColorScheme,
} from "@mantine/core";
import { useClickOutside, useDisclosure, useWindowEvent } from "@mantine/hooks";
import { Suspense } from "react";
const Picker = React.lazy(() => import("@emoji-mart/react"));
import { useTranslation } from "react-i18next";

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
  readOnly: boolean;
  actionIconProps?: {
    size?: string;
    variant?: string;
    c?: string;
  };
}

function EmojiPicker({
  onEmojiSelect,
  icon,
  removeEmojiAction,
  readOnly,
  actionIconProps,
}: EmojiPickerInterface) {
  const { t } = useTranslation();
  const [opened, handlers] = useDisclosure(false);
  const { colorScheme } = useMantineColorScheme();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [dropdown, setDropdown] = useState<HTMLDivElement | null>(null);

  useClickOutside(
    () => handlers.close(),
    ["mousedown", "touchstart"],
    [dropdown, target],
  );

  // We need this because the default Mantine popover closeOnEscape does not work
  useWindowEvent("keydown", (event) => {
    if (opened && event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      handlers.close();
    }
  });

  const handleEmojiSelect = (emoji) => {
    onEmojiSelect(emoji);
    handlers.close();
  };

  const handleRemoveEmoji = () => {
    removeEmojiAction();
    handlers.close();
  };

  return (
    <Popover
      opened={opened}
      onClose={handlers.close}
      width={332}
      position="bottom"
      disabled={readOnly}
      closeOnEscape={true}
    >
      <Popover.Target ref={setTarget}>
        <ActionIcon 
          c={actionIconProps?.c || "gray"} 
          variant={actionIconProps?.variant || "transparent"} 
          size={actionIconProps?.size}
          onClick={handlers.toggle}
        >
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Suspense fallback={null}>
        <Popover.Dropdown bg="000" style={{ border: "none" }} ref={setDropdown}>
          <Picker
            data={async () => (await import("@emoji-mart/data")).default}
            onEmojiSelect={handleEmojiSelect}
            perLine={8}
            skinTonePosition="search"
            theme={colorScheme}
          />
          <Button
            variant="default"
            c="gray"
            size="xs"
            style={{
              position: "absolute",
              zIndex: 2,
              bottom: "1rem",
              right: "1rem",
            }}
            onClick={handleRemoveEmoji}
          >
            {t("Remove")}
          </Button>
        </Popover.Dropdown>
      </Suspense>
    </Popover>
  );
}

export default EmojiPicker;
