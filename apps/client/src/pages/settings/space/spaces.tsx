import SettingsTitle from "@/components/settings/settings-title.tsx";
import SpaceList from "@/features/space/components/space-list.tsx";
import { Group } from "@mantine/core";
import CreateSpaceModal from "@/features/space/components/create-space-modal.tsx";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { Navigate } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import useCurrentUser from "@/features/user/hooks/use-current-user.ts";
import { UserRole } from "@/lib/types.ts";

export default function Spaces() {
  const { t } = useTranslation();
  // role from the query: the stored user atom is still empty on a first visit
  const { data: currentUser } = useCurrentUser();
  const role = currentUser?.user?.role;

  if (role !== UserRole.ADMIN && role !== UserRole.OWNER) {
    return <Navigate to={APP_ROUTE.SPACES} replace />;
  }

  return (
    <>
      <DocumentTitle title={t("Spaces")} />
      <SettingsTitle title={t("Spaces")} />

      <Group my="md" justify="flex-end">
        <CreateSpaceModal />
      </Group>

      <SpaceList />
    </>
  );
}
