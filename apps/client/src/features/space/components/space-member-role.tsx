import { IconCheck } from "@tabler/icons-react";
import { Group, Select, SelectProps, Text } from "@mantine/core";
import React from "react";
import { spaceRoleData } from "@/features/space/types/space-role-data.ts";

const iconProps = {
  stroke: 1.5,
  color: "currentColor",
  opacity: 0.6,
  size: 18,
};

const renderSelectOption: SelectProps["renderOption"] = ({
  option,
  checked,
}) => (
  <Group flex="1" gap="xs">
    <div>
      <Text size="sm">{option.label}</Text>
      <Text size="xs" opacity={0.65}>
        {option["description"]}
      </Text>
    </div>{" "}
    {checked && (
      <IconCheck style={{ marginInlineStart: "auto" }} {...iconProps} />
    )}
  </Group>
);

interface SpaceMemberRoleProps {
  onSelect: (value: string) => void;
  defaultRole: string;
  label?: string;
}

export function SpaceMemberRole({
  onSelect,
  defaultRole,
  label,
}: SpaceMemberRoleProps) {
  return (
    <Select
      data={spaceRoleData}
      defaultValue={defaultRole}
      label={label}
      onChange={onSelect}
      renderOption={renderSelectOption}
      allowDeselect={false}
      variant="filled"
    />
  );
}
