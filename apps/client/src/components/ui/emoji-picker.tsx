import React, { ReactNode, useEffect, useState } from "react";
import {
  ActionIcon,
  Popover,
  Button,
  useMantineColorScheme,
} from "@mantine/core";
import { useClickOutside, useDisclosure, useWindowEvent } from "@mantine/hooks";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

// Load the picker module AND the emoji data in parallel inside the lazy
// resolution, then bind the data into the component. React.lazy only finishes
// suspending once both are in memory, so the Suspense boundary hides the
// Remove button until the Picker can render with real content.
const Picker = React.lazy(async () => {
  const [pickerModule, dataModule] = await Promise.all([
    import("@slidoapp/emoji-mart-react"),
    import("@slidoapp/emoji-mart-data"),
  ]);
  const PickerComp = pickerModule.default;
  const data = dataModule.default;
  return {
    default: (props: any) => <PickerComp {...props} data={data} />,
  };
});

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
  readOnly: boolean;
  actionIconProps?: {
    size?: string;
    variant?: string;
    c?: string;
    tabIndex?: number;
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

  // emoji-mart's built-in autoFocus calls .focus() without preventScroll, which
  // makes the browser scroll every scrollable ancestor of the search input to
  // bring it on screen — including the page editor's scroll container, so the
  // page jumps to the top whenever the picker is opened from a scrolled-down
  // position. The search input lives inside the <em-emoji-picker> custom
  // element's shadow root, so we poll for it after the dropdown mounts and
  // focus it ourselves with preventScroll.
  useEffect(() => {
    if (!opened || !dropdown) return;
    let cancelled = false;
    let rafId = 0;
    const tryFocus = (attempts: number) => {
      if (cancelled) return;
      const pickerEl = dropdown.querySelector("em-emoji-picker");
      const input = pickerEl?.shadowRoot?.querySelector<HTMLInputElement>(
        'input[type="search"]',
      );
      if (input) {
        input.focus({ preventScroll: true });
        return;
      }
      if (attempts < 60) {
        rafId = requestAnimationFrame(() => tryFocus(attempts + 1));
      }
    };
    rafId = requestAnimationFrame(() => tryFocus(0));
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [opened, dropdown]);

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
          tabIndex={actionIconProps?.tabIndex}
          onClick={handlers.toggle}
          aria-label={t("Pick emoji")}
          aria-haspopup="dialog"
          aria-expanded={opened}
        >
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Suspense fallback={null}>
        <Popover.Dropdown bg="000" style={{ border: "none" }} ref={setDropdown}>
          <Picker
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
