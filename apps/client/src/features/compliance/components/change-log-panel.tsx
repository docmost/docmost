import { Button, Center, Group, Loader, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useChangeSetsQuery } from "@/features/compliance/queries/change-set-query.ts";
import ChangeSetItem from "@/features/compliance/components/change-set-item.tsx";
import ChangeSetFormModal from "@/features/compliance/components/change-set-form-modal.tsx";

export default function ChangeLogPanel() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);

  const canEdit = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  const scope = useMemo(() => ({ pageId: page?.id }), [page?.id]);

  const [opened, { open, close }] = useDisclosure(false);
  const [correctsId, setCorrectsId] = useState<string | undefined>(undefined);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChangeSetsQuery(scope);

  const changeSets = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const handleNew = () => {
    setCorrectsId(undefined);
    open();
  };

  const handleCorrect = (changeSetId: string) => {
    setCorrectsId(changeSetId);
    open();
  };

  if (!page) {
    return <></>;
  }

  return (
    <div>
      {canEdit && (
        <Button
          fullWidth
          variant="light"
          mb="sm"
          leftSection={<IconPlus size={16} />}
          onClick={handleNew}
        >
          {t("New change")}
        </Button>
      )}

      {isLoading ? (
        <Center py="sm">
          <Loader size="sm" />
        </Center>
      ) : changeSets.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("No changes documented yet.")}
        </Text>
      ) : (
        <>
          {changeSets.map((changeSet) => (
            <ChangeSetItem
              key={changeSet.id}
              changeSet={changeSet}
              canEdit={canEdit}
              onCorrect={handleCorrect}
            />
          ))}

          {hasNextPage && (
            <Group justify="center" my="sm">
              <Button
                variant="default"
                size="xs"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t("Load more")}
              </Button>
            </Group>
          )}
        </>
      )}

      <ChangeSetFormModal
        opened={opened}
        onClose={close}
        scope={scope}
        correctsId={correctsId}
      />
    </div>
  );
}
