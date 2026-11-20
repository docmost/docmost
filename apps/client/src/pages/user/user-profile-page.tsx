import { Anchor, Container, Stack, Text } from "@mantine/core";
import { IconUserQuestion } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { validate as isValidUuid } from "uuid";
import { DocumentTitle } from "@/components/ui/document-title";
import { EmptyState } from "@/components/ui/empty-state";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { UserProfileHeader } from "@/features/user/components/profile/user-profile-header";
import { UserProfileManageMenu } from "@/features/user/components/profile/user-profile-manage-menu";
import { UserProfileOverview } from "@/features/user/components/profile/user-profile-overview";
import { UserProfileSkeleton } from "@/features/user/components/profile/user-profile-skeleton";
import { useUserProfileQuery } from "@/features/user/queries/user-query";
import useUserRole from "@/hooks/use-user-role";
import APP_ROUTE from "@/lib/app-route";

export default function UserProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useAtomValue(userAtom);
  const { isAdmin } = useUserRole();
  const validUserId = isValidUuid(userId) ? userId : undefined;
  const { data: profile, isError } = useUserProfileQuery(validUserId);
  const notFound = !validUserId || (!profile && isError);
  const isSelf = (profile?.id ?? validUserId) === currentUser?.id;

  return (
    <>
      <DocumentTitle
        title={notFound ? t("Profile not found") : profile?.name}
      />

      <Container size={900} pt="lg" pb="xl">
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            <Anchor
              component={Link}
              to={APP_ROUTE.SETTINGS.WORKSPACE.MEMBERS}
              c="dimmed"
              inherit
            >
              {t("Members")}
            </Anchor>
            {profile && (
              <>
                {" / "}
                <Text component="span" c="bright" fw={500}>
                  {profile.name}
                </Text>
              </>
            )}
          </Text>

          {notFound ? (
            <EmptyState
              icon={IconUserQuestion}
              title={t("Profile not found")}
              description={t(
                "This profile doesn't exist or isn't available to you.",
              )}
            />
          ) : profile ? (
            <>
              <UserProfileHeader
                profile={profile}
                actions={
                  isAdmin &&
                  !isSelf &&
                  !profile.deletedAt && (
                    <UserProfileManageMenu profile={profile} />
                  )
                }
              />
              <UserProfileOverview userId={profile.id} isSelf={isSelf} />
            </>
          ) : (
            <UserProfileSkeleton />
          )}
        </Stack>
      </Container>
    </>
  );
}
