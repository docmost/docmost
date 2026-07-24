import { Badge, Group, Stack, Text } from "@mantine/core";

export type FeatureStatusKind =
  | "working"
  | "unavailable"
  | "insecure"
  | "partial";

const STATUS_LABEL: Record<
  FeatureStatusKind,
  { color: string; label: string }
> = {
  working: { color: "green", label: "Funciona" },
  unavailable: { color: "gray", label: "Indisponível nesta edição" },
  insecure: { color: "red", label: "Não protege" },
  partial: { color: "yellow", label: "Parcial" },
};

interface FeatureStatusProps {
  status: FeatureStatusKind;
  note: string;
}

export default function FeatureStatus({ status, note }: FeatureStatusProps) {
  const { color, label } = STATUS_LABEL[status];
  const pending = status !== "working";

  return (
    <Stack gap={4} mb="sm">
      <Group gap="xs">
        <Badge color={color} variant="light" radius="sm">
          {label}
        </Badge>
        {pending && (
          <Badge color="orange" variant="outline" radius="sm">
            Pendente
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        {note}
      </Text>
    </Stack>
  );
}
