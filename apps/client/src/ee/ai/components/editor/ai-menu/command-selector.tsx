import { Loader, Menu, ScrollArea } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { ReactNode } from "react";
import { CommandItem } from "./command-items.ts";
import classes from "./ai-menu.module.css";

interface CommandSelectorProps {
  selectedIndex: number;

  isLoading: boolean;
  output: string;
  currentItems: CommandItem[];
  children: ReactNode;
  handleCommand(item: CommandItem): void;
}

const CommandSelector = ({
  selectedIndex,
  children,
  isLoading,
  output,
  currentItems,
  handleCommand,
}: CommandSelectorProps) => {
  return (
    <Menu
      opened={!isLoading && currentItems.length > 0}
      middlewares={{ flip: false }}
      position="bottom-start"
      offset={4}
      width={250}
      trapFocus={false}
      shadow="lg"
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <ScrollArea.Autosize type="scroll" scrollbarSize={5} mah={300}>
          {currentItems.map((item, index) => {
            const isSelected = selectedIndex === index;
            const showLoader =
              isLoading && output === "" && !item.subCommandSet;

            return (
              <Menu.Item
                key={item.id}
                className={isSelected ? classes.menuItemSelected : undefined}
                leftSection={
                  showLoader ? (
                    <Loader size={14} />
                  ) : item.icon ? (
                    <item.icon size={16} />
                  ) : undefined
                }
                rightSection={
                  item.subCommandSet ? (
                    <IconChevronRight size={14} />
                  ) : undefined
                }
                onClick={() => handleCommand(item)}
                disabled={isLoading}
              >
                {item.name}
              </Menu.Item>
            );
          })}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
};

export { CommandSelector };
