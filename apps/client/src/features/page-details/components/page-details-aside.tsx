import {
  Divider,
  Group,
  Skeleton,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useBacklinksCountQuery } from "@/features/page-details/queries/backlinks-query.ts";
import { BacklinksModal } from "./backlinks-modal";
import { formattedDate, timeAgo } from "@/lib/time.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";

export function PageDetailsAside() {
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const pageEditor = useAtomValue(pageEditorAtom);
  const { data: counts, isLoading: countsLoading } = useBacklinksCountQuery(page?.id);
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);

  if (!page) return null;

  const wordCount: number =
    pageEditor?.storage?.characterCount?.words?.() ?? 0;
  const characterCount: number =
    pageEditor?.storage?.characterCount?.characters?.() ?? 0;

  return (
    <>
      <Stack gap="md">
        <PeopleSection
          creator={page.creator}
          lastUpdatedBy={page.lastUpdatedBy}
        />

        <Divider />

        <StatsSection
          wordCount={wordCount}
          characterCount={characterCount}
          createdAt={page.createdAt}
          updatedAt={page.updatedAt}
        />

        <Divider />

        <BacklinksSection
          incomingCount={counts?.incoming ?? 0}
          outgoingCount={counts?.outgoing ?? 0}
          isLoading={countsLoading}
          onClick={openModal}
        />
      </Stack>

      <BacklinksModal
        pageId={page.id}
        opened={modalOpened}
        onClose={closeModal}
      />
    </>
  );
}

function PeopleSection({
  creator,
  lastUpdatedBy,
}: {
  creator: { id: string; name: string; avatarUrl: string } | null;
  lastUpdatedBy: { id: string; name: string; avatarUrl: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <PersonRow label={t("Created by")} person={creator} />
      <PersonRow label={t("Last updated by")} person={lastUpdatedBy} />
    </Stack>
  );
}

function PersonRow({
  label,
  person,
}: {
  label: string;
  person: { id: string; name: string; avatarUrl: string } | null;
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {person ? (
        <Group gap={6} wrap="nowrap">
          <CustomAvatar
            avatarUrl={person.avatarUrl}
            name={person.name}
            size={20}
            radius="xl"
          />
          <Text size="sm" lineClamp={1}>
            {person.name}
          </Text>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          —
        </Text>
      )}
    </Group>
  );
}

function StatsSection({
  wordCount,
  characterCount,
  createdAt,
  updatedAt,
}: {
  wordCount: number;
  characterCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Text size="xs" fw={500} c="dimmed">
        {t("Stats")}
      </Text>
      <StatRow label={t("Word count")} value={String(wordCount)} />
      <StatRow label={t("Characters")} value={String(characterCount)} />
      <StatRow
        label={t("Created")}
        value={formattedDate(new Date(createdAt))}
      />
      <StatRow
        label={t("Last updated")}
        value={timeAgo(new Date(updatedAt))}
      />
    </Stack>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

function BacklinksSection({
  incomingCount,
  outgoingCount,
  isLoading,
  onClick,
}: {
  incomingCount: number;
  outgoingCount: number;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Text size="xs" fw={500} c="dimmed">
        {t("Backlinks")}
      </Text>
      <BacklinksRow
        label={t("Incoming links")}
        count={incomingCount}
        isLoading={isLoading}
        onClick={onClick}
      />
      <BacklinksRow
        label={t("Outgoing links")}
        count={outgoingCount}
        isLoading={isLoading}
        onClick={onClick}
      />
    </Stack>
  );
}

function BacklinksRow({
  label,
  count,
  isLoading,
  onClick,
}: {
  label: string;
  count: number;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: "4px 4px",
        borderRadius: 4,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Group gap={6} wrap="nowrap">
          {isLoading ? (
            <Skeleton height={18} width={20} />
          ) : (
            <Text size="sm">{count}</Text>
          )}
          <IconChevronRight size={16} stroke={2} color="var(--mantine-color-dimmed)" />
        </Group>
      </Group>
    </UnstyledButton>
  );
}
