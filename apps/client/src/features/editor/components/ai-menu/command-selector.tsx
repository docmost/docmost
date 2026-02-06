import { Button, Menu, ScrollArea } from "@mantine/core";
import { ReactNode } from "react";
import { CommandItem } from "./command-items";

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
      position="bottom-start"
      offset={4}
      width={300}
      trapFocus={false}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <ScrollArea.Autosize type="scroll" mah={400}>
          <Button.Group orientation="vertical" display="flex">
            {currentItems.map((item, index) => {
              const unselectedVariant =
                item.id === "back" ? "subtle" : "default";

              return (
                <Button
                  key={item.id}
                  variant={
                    selectedIndex === index ? "light" : unselectedVariant
                  }
                  leftSection={item.icon ? <item.icon size={16} /> : undefined}
                  justify="left"
                  fullWidth
                  onClick={() => handleCommand(item)}
                  style={{ border: "none" }}
                  loading={isLoading && output === "" && !item.subCommandSet}
                  disabled={isLoading}
                >
                  {item.name}
                </Button>
              );
            })}
          </Button.Group>
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
};

export { CommandSelector };
