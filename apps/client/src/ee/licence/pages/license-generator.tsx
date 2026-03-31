import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useGenerateLicenseMutation } from "@/ee/licence/queries/license-query.ts";
import {
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  TextInput,
  Textarea,
  Text,
  CopyButton,
  ActionIcon,
  Tooltip,
  Paper,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { isCloud } from "@/lib/config.ts";

export default function LicenseGenerator() {
  const { isAdmin } = useUserRole();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const generateMutation = useGenerateLicenseMutation();

  const form = useForm({
    initialValues: {
      customerName: "",
      seatCount: 100,
      expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      trial: false,
    },
    validate: {
      customerName: (v) => (v.trim().length < 2 ? "Name too short" : null),
      seatCount: (v) => (v < 1 ? "Min 1 seat" : null),
      expiresAt: (v) => (!v ? "Required" : null),
    },
  });

  if (!isAdmin || isCloud()) {
    return null;
  }

  const handleSubmit = form.onSubmit(async (values) => {
    const result = await generateMutation.mutateAsync({
      customerName: values.customerName,
      seatCount: values.seatCount,
      expiresAt: values.expiresAt.toISOString(),
      trial: values.trial,
    });
    setGeneratedKey(result.licenseKey);
  });

  return (
    <>
      <Helmet>
        <title>License Generator - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title="License Generator" />

      <Stack gap="md" maw={600}>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Customer name"
              placeholder="e.g. Wilhelm-Raabe-Schule"
              {...form.getInputProps("customerName")}
            />

            <NumberInput
              label="Seat count"
              min={1}
              max={100000}
              {...form.getInputProps("seatCount")}
            />

            <DatePickerInput
              label="Expires at"
              minDate={new Date()}
              {...form.getInputProps("expiresAt")}
            />

            <Switch
              label="Trial license"
              {...form.getInputProps("trial", { type: "checkbox" })}
            />

            <Button
              type="submit"
              loading={generateMutation.isPending}
              w="fit-content"
            >
              Generate license key
            </Button>
          </Stack>
        </form>

        {generatedKey && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={500} size="sm">Generated license key</Text>
                <CopyButton value={generatedKey} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <Textarea
                value={generatedKey}
                readOnly
                autosize
                minRows={3}
                styles={{ input: { fontFamily: "monospace", fontSize: "12px" } }}
              />
            </Stack>
          </Paper>
        )}
      </Stack>
    </>
  );
}
