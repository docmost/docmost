import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { IVerifier } from "@/ee/page-verification/types/page-verification.types";
import { useTranslation } from "react-i18next";

type VerifierListProps = {
  verifiers: IVerifier[];
  canManage?: boolean;
  onRemove?: (userId: string) => void;
};

export function VerifierList({
  verifiers,
  canManage,
  onRemove,
}: VerifierListProps) {
  const { t } = useTranslation();

  if (verifiers.length === 0) return null;

  return (
    <>
      {verifiers.map((verifier, index) => (
        <Group
          key={verifier.id}
          justify="space-between"
          wrap="nowrap"
          py={6}
          style={{
            borderBottom:
              index < verifiers.length - 1
                ? "1px solid var(--mantine-color-gray-1)"
                : undefined,
          }}
        >
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <CustomAvatar
              avatarUrl={verifier.avatarUrl}
              name={verifier.name}
              size={28}
            />
            <div style={{ minWidth: 0 }}>
              <Text size="sm" truncate="end">
                {verifier.name}
              </Text>
              {verifier.email && (
                <Text size="xs" c="dimmed" truncate="end">
                  {verifier.email}
                </Text>
              )}
            </div>
          </Group>
          {canManage && onRemove && (
            <Tooltip label={t("Remove")} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => onRemove(verifier.id)}
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ))}
    </>
  );
}
