import React, { forwardRef } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { Group, Text, Menu, Button } from "@mantine/core";
import { IRoleData } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";

interface RoleButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  name: string;
}

const RoleButton = forwardRef<HTMLButtonElement, RoleButtonProps>(
  ({ name, ...others }: RoleButtonProps, ref) => (
    <Button
      variant="default"
      ref={ref}
      style={{
        border: "none",
      }}
      rightSection={<IconChevronDown size="1rem" />}
      {...others}
    >
      {name}
    </Button>
  ),
);

interface RoleMenuProps {
  roles: IRoleData[];
  roleName: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export default function RoleSelectMenu({
  roles,
  roleName,
  onChange,
  disabled,
}: RoleMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu withArrow>
      <Menu.Target>
        <RoleButton name={t(roleName)} disabled={disabled} />
      </Menu.Target>

      <Menu.Dropdown>
        {roles?.map((item) => (
          <Menu.Item
            onClick={() => onChange && onChange(item.value)}
            key={item.value}
          >
            <Group flex="1" gap="xs">
              <div>
                <Text size="sm">{t(item.label)}</Text>
                <Text size="xs" opacity={0.65}>
                  {t(item.description)}
                </Text>
              </div>
              {item.label === roleName && <IconCheck size={20} />}
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
