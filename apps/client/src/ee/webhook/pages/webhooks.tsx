import { useMemo, useState } from "react";
import { Button, Group, Space } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import Paginate from "@/components/common/paginate";
import { useCursorPaginate } from "@/hooks/use-cursor-paginate";
import useUserRole from "@/hooks/use-user-role";
import { useWebhooks } from "@/ee/webhook/queries/webhook-query";
import { WebhookTable } from "@/ee/webhook/components/webhook-table";
import { CreateWebhookModal } from "@/ee/webhook/components/create-webhook-modal";
import { EditWebhookModal } from "@/ee/webhook/components/edit-webhook-modal";
import { WebhookSecretModal } from "@/ee/webhook/components/webhook-secret-modal";
import { DeliveryDrawer } from "@/ee/webhook/components/delivery-drawer";
import type { IWebhook, IListWebhooksParams } from "@/ee/webhook/types/webhook.types";

export default function Webhooks() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { cursor, goNext, goPrev } = useCursorPaginate();

  const [createOpened, setCreateOpened] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(
    null,
  );

  const params: IListWebhooksParams = useMemo(
    () => ({ cursor, limit: 50 }),
    [cursor],
  );

  const { data, isLoading } = useWebhooks(params);

  if (!isAdmin) {
    return null;
  }

  const handleEdit = (webhook: IWebhook) => {
    setEditingWebhookId(webhook.id);
  };

  const handleViewDeliveries = (webhook: IWebhook) => {
    setDeliveryWebhookId(webhook.id);
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Webhooks")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Webhooks")} />

      <Group justify="flex-end" mb="md">
        <Button onClick={() => setCreateOpened(true)}>
          {t("Add webhook")}
        </Button>
      </Group>

      <WebhookTable
        webhooks={data?.items}
        isLoading={isLoading}
        onEdit={handleEdit}
        onViewDeliveries={handleViewDeliveries}
      />

      <Space h="md" />

      {data?.items && data.items.length > 0 && (
        <Paginate
          hasPrevPage={data?.meta?.hasPrevPage}
          hasNextPage={data?.meta?.hasNextPage}
          onNext={() => goNext(data?.meta?.nextCursor)}
          onPrev={goPrev}
        />
      )}

      <CreateWebhookModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onSuccess={(signingSecret) => setRevealedSecret(signingSecret)}
      />

      <WebhookSecretModal
        opened={!!revealedSecret}
        onClose={() => setRevealedSecret(null)}
        secret={revealedSecret}
      />

      <EditWebhookModal
        opened={!!editingWebhookId}
        onClose={() => setEditingWebhookId(null)}
        webhookId={editingWebhookId}
      />

      <DeliveryDrawer
        opened={!!deliveryWebhookId}
        onClose={() => setDeliveryWebhookId(null)}
        webhookId={deliveryWebhookId}
      />
    </>
  );
}
