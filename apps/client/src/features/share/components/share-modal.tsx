import {
  Button,
  Group,
  MantineSize,
  Popover,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconWorld } from "@tabler/icons-react";
import React, { useState } from "react";
import { useShareStatusQuery } from "@/features/share/queries/share-query.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy.tsx";

export default function ShareModal() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data } = useShareStatusQuery(extractPageSlugId(pageSlug));

  const publicLink =
    window.location.protocol +'//' + window.location.host +
    "/share/" +
    data?.["share"]?.["key"] +
    "/" +
    pageSlug;

  return (
    <Popover width={350} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Button
          variant="default"
          style={{ border: "none" }}
          leftSection={<IconWorld size={20} stroke={1.5} />}
        >
          Share
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Group justify="space-between" wrap="nowrap" gap="xl">
          <div>
            <Text size="md">{t("Make page public")}</Text>
          </div>
          <ToggleShare isChecked={true}></ToggleShare>
        </Group>

        <Group my="sm" grow>
          <TextInput
            variant="filled"
            value={publicLink}
            pointer
            readOnly
            rightSection={<CopyTextButton text={publicLink} />}
          />
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}

interface PageWidthToggleProps {
  isChecked: boolean;
  size?: MantineSize;
  label?: string;
}

export function ToggleShare({ isChecked, size, label }: PageWidthToggleProps) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(isChecked);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    setChecked(value);
  };

  return (
    <Switch
      size={size}
      label={label}
      labelPosition="left"
      defaultChecked={checked}
      onChange={handleChange}
      aria-label={t("Toggle share")}
    />
  );
}
