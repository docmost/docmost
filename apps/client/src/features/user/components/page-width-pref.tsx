import { Group, Text, Switch } from "@mantine/core";
import { useAtom } from "jotai/index";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import React, { useState } from "react";

export default function PageWidthPref() {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">Full page width</Text>
        <Text size="sm" c="dimmed">
          Choose your preferred page width.
        </Text>
      </div>

      <WidthToggle />
    </Group>
  );
}

function WidthToggle() {
  const [user, setUser] = useAtom(userAtom);
  const [checked, setChecked] = useState(
    user.settings?.preferences?.fullPageWidth,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    const updatedUser = await updateUser({ fullPageWidth: value });
    setChecked(value);
    setUser(updatedUser);
  };

  return (
    <Switch
      defaultChecked={checked}
      onChange={handleChange}
      aria-label="Toggle full page width"
    />
  );
}
