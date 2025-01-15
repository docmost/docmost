import React, { ReactNode, useState } from "react";
import {
  ActionIcon,
  Popover,
  Button,
  useMantineColorScheme,
} from "@mantine/core";
import { useClickOutside, useDisclosure } from "@mantine/hooks";
import { Suspense } from "react";
const Picker = React.lazy(() => import("@emoji-mart/react"));

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
  readOnly: boolean;
}

function EmojiPicker({
  onEmojiSelect,
  icon,
  removeEmojiAction,
  readOnly,
}: EmojiPickerInterface) {
  const [opened, handlers] = useDisclosure(false);
  const { colorScheme } = useMantineColorScheme();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [dropdown, setDropdown] = useState<HTMLDivElement | null>(null);

  useClickOutside(
    () => handlers.close(),
    ["mousedown", "touchstart"],
    [dropdown, target],
  );

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
    >
      <Popover.Target ref={setTarget}>
        <ActionIcon c="gray" variant="transparent" onClick={handlers.toggle}>
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bg="000" style={{ border: "none" }} ref={setDropdown}>
        <Suspense fallback={null}>
          <Picker
            data={async () => (await import("@emoji-mart/data")).default}
            onEmojiSelect={handleEmojiSelect}
            perLine={8}
            skinTonePosition="search"
            theme={colorScheme}
          />
        </Suspense>
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
          Remove
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}

export default EmojiPicker;
