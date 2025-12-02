import { Dispatch, FC, SetStateAction, useState } from "react";
import { IconHighlight } from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  ColorPicker,
  Flex,
  Input,
  Popover,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import { useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

interface HighlightColorSelectorProps {
  editor: ReturnType<typeof useEditor>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: "Blue",
    color: "#c1ecf9",
  },
  {
    name: "Green",
    color: "#acf79f",
  },
  {
    name: "Purple",
    color: "#d0a1f0",
  },
  {
    name: "Red",
    color: "#f09797",
  },
  {
    name: "Yellow",
    color: "#fbf4a2",
  },
  {
    name: "Orange",
    color: "#ffc996",
  },
  {
    name: "Pink",
    color: "#fcaed1",
  },
  {
    name: "Gray",
    color: "#d9d9d9",
  },
];

export const HighlightColorSelector: FC<HighlightColorSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();
  const activeColorItem = editor.isActive("highlight") ? editor.getAttributes("highlight")["color"] : '';

  const [color, setColor] = useState(activeColorItem || '#ffff00')

  const isValidHexCode = (str : string) : boolean => {
    const regex = new RegExp(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
    if(str === null){
      return false;
    }
    return regex.test(str);
  }

  return (
    <Popover width={200} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Highlight text color")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            style={{
              border: "none",
              color: activeColorItem,
            }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconHighlight size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        {/* make mah responsive */}
        <ScrollArea.Autosize type="scroll" mah="400">
          <Text span c="dimmed" tt="uppercase" inherit>
            {t("Color")}
          </Text>

          <ColorPicker
            fullWidth
            value={color}
            onChange={(newColor) => {
              setColor(newColor);
              editor.commands.unsetHighlight();
              editor
                .chain()
                .focus()
                .setHighlight({ color: newColor })
                .run();
              setIsOpen(false);
            }}
            swatchesPerRow={4}
            swatches={Array.from(HIGHLIGHT_COLORS, (item) => item.color)}
          />

          <Input
            size="xs"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />

          <Flex
            mih={50}
            gap="xs"
            justify="center"
            align="center"
            direction="row"
            wrap="wrap"
          >
            <Button
              variant="default"
              size="xs"
              onClick={() => {
                editor.commands.unsetHighlight();
                setIsOpen(false);
              }}
              >
              {t("Remove")}
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={() => {
                if(isValidHexCode(color)){
                  editor.commands.unsetHighlight();
                  editor
                    .chain()
                    .focus()
                    .setHighlight({ color: color })
                    .run();
                  setIsOpen(false);
                }
              }}
              >
              {t("Set")}
            </Button>
          </Flex>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
