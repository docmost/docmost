import { useState } from "react";
import { Alert, Button, Group, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import useUserRole from "@/hooks/use-user-role";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import {
  ISiemDestination,
  SIEM_MAX_DESTINATIONS_PER_WORKSPACE,
} from "@/ee/siem/types/siem.types";
import {
  useRetrySiemDestinationMutation,
  useSiemDestinationsQuery,
  extractErrorMessage,
  useTestSiemDestinationMutation,
  useUpdateSiemDestinationMutation,
} from "@/ee/siem/queries/siem-query";
import { DestinationTable } from "@/ee/siem/components/destination-table";
import { DestinationFormModal } from "@/ee/siem/components/destination-form-modal";
import { DeleteDestinationModal } from "@/ee/siem/components/delete-destination-modal";

export default function SiemStreamingPanel() {
  const { t } = useTranslation();
  const { isOwner } = useUserRole();
  const hasFeature = useHasFeature(Feature.SIEM);
  const { data, isLoading, isError, error } = useSiemDestinationsQuery(hasFeature);
  const updateMutation = useUpdateSiemDestinationMutation();
  const retryMutation = useRetrySiemDestinationMutation();
  const testMutation = useTestSiemDestinationMutation();
  const [formOpened, setFormOpened] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [selected, setSelected] = useState<ISiemDestination | null>(null);

  if (!isOwner) {
    return null;
  }

  const atDestinationLimit =
    (data?.length ?? 0) >= SIEM_MAX_DESTINATIONS_PER_WORKSPACE;

  const handleTest = async (destination: ISiemDestination) => {
    const result = await testMutation
      .mutateAsync({
        type: destination.type,
        config: destination.config as unknown as Record<string, unknown>,
        destinationId: destination.id,
      })
      .catch(() => null);
    if (!result) return;
    notifications.show({
      message: result.delivered
        ? t("Test event delivered to {{name}}", { name: destination.name })
        : result.error,
      color: result.delivered ? "green" : "red",
    });
  };

  return (
    <>
      {!hasFeature && (
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" mb="md">
          {t("SIEM streaming requires an Enterprise license.")}
        </Alert>
      )}

      <Group justify="flex-end" mb="md">
        <Tooltip
          label={t("Maximum of {{limit}} destinations reached", {
            limit: SIEM_MAX_DESTINATIONS_PER_WORKSPACE,
          })}
          disabled={!atDestinationLimit}
        >
          <span>
            <Button
              onClick={() => {
                setSelected(null);
                setFormOpened(true);
              }}
              disabled={!hasFeature || atDestinationLimit}
            >
              {t("Add destination")}
            </Button>
          </span>
        </Tooltip>
      </Group>

      {isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {t("Could not load SIEM destinations: {{message}}", {
            message: extractErrorMessage(error),
          })}
        </Alert>
      )}

      {hasFeature && !isError && (
      <DestinationTable
        destinations={data}
        isLoading={isLoading}
        onEdit={(destination) => {
          setSelected(destination);
          setFormOpened(true);
        }}
        onTest={handleTest}
        onRetry={(destination) => retryMutation.mutate({ destinationId: destination.id })}
        onDelete={(destination) => {
          setSelected(destination);
          setDeleteOpened(true);
        }}
        onToggle={(destination, enabled) =>
          updateMutation.mutate({ destinationId: destination.id, enabled })
        }
      />
      )}

      <DestinationFormModal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        destination={selected}
      />
      <DeleteDestinationModal
        opened={deleteOpened}
        onClose={() => setDeleteOpened(false)}
        destination={selected}
      />
    </>
  );
}
