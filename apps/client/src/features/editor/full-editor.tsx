import classes from "@/features/editor/styles/editor.module.css";
import React, { useEffect } from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import {
  ActionIcon,
  Alert,
  Button,
  Container,
  Divider,
  Group,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { UserProfilePopover } from "@/features/user/components/user-profile-popover";
import {
  PageVerificationBadge,
  usePageEditLockSync,
  usePageEditMode,
} from "@/ee/page-verification";
import { useTranslation } from "react-i18next";
import { IContributor } from "@/features/page/types/page.types.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { useAsideTriggerProps } from "@/hooks/use-toggle-aside.tsx";
import { DeletedPageBanner } from "@/features/page/trash/components/deleted-page-banner.tsx";
import SpaceArchivedNotice from "@/features/space/components/space-archived-notice.tsx";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import clsx from "clsx";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { EmptyPageGetStarted } from "@/features/editor/components/empty-page/empty-page-get-started";
import { AddCoverButton } from "@/features/page-cover/components/add-cover-button.tsx";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);
const MemoizedDeletedPageBanner = React.memo(DeletedPageBanner);

type PageUser = {
  id: string;
  name: string;
  avatarUrl: string;
};

// Module-level flag: survives component unmount/remount on page navigation,
// reset only on full page reload (i.e. a new app session).
let defaultEditModeApplied = false;

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  content: string;
  spaceId: string;
  spaceSlug: string;
  editable: boolean;
  creator?: PageUser;
  contributors?: IContributor[];
  canComment?: boolean;
  hasCover?: boolean;
  showToolbar: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  content,
  spaceId,
  spaceSlug,
  editable,
  creator,
  contributors,
  canComment,
  hasCover,
  showToolbar,
}: FullEditorProps) {
  const { t } = useTranslation();
  const [user] = useAtom(userAtom);
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;
  const setCurrentPageEditMode = useSetAtom(currentPageEditModeAtom);
  const userPageEditMode =
    user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const {
    editMode,
    isCheckingLock,
    verificationUnavailable,
    retryVerification,
    retryingVerification,
  } = usePageEditMode(pageId);
  const isEditMode = editMode === PageEditMode.Edit;

  usePageEditLockSync(pageId);

  // Apply the user's saved preference only once on initial load, not on every
  // page navigation — so the mode sticks across navigations within a session.
  useEffect(() => {
    if (user && !defaultEditModeApplied) {
      setCurrentPageEditMode(userPageEditMode as PageEditMode);
      defaultEditModeApplied = true;
    }
  }, [user, userPageEditMode, setCurrentPageEditMode]);

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 900}
      className={classes.editor}
    >
      {showToolbar && !hasCover && (
        <div className={classes.toolbarSpacer} aria-hidden />
      )}
      {space && <SpaceArchivedNotice space={space} />}
      <MemoizedDeletedPageBanner slugId={slugId} />
      {editable && verificationUnavailable && (
        <Alert color="yellow" mx="md" mb="sm">
          <Group justify="space-between">
            <Text size="sm">
              {t("Editing is paused because the page verification status could not be checked.")}
            </Text>
            <Button
              variant="light"
              size="xs"
              loading={retryingVerification}
              onClick={() => retryVerification()}
            >
              {t("Try again")}
            </Button>
          </Group>
        </Alert>
      )}
      <div className={classes.titleArea}>
        {editable && !hasCover && (
          <div className={clsx("print-hide", classes.coverRow)}>
            {isEditMode && !isCheckingLock && (
              <AddCoverButton slugId={slugId} className={classes.addCover} />
            )}
          </div>
        )}
        <MemoizedTitleEditor
          pageId={pageId}
          slugId={slugId}
          title={title}
          spaceSlug={spaceSlug}
          editable={editable}
        />
      </div>
      <PageByline
        creator={creator}
        contributors={contributors}
        readOnly={!editable}
      />
      <div className={clsx(classes.documentBody, classes.documentReveal)}>
        <MemoizedPageEditor
          pageId={pageId}
          editable={editable}
          content={content}
          canComment={canComment}
        />
      </div>
      <EmptyPageGetStarted
        pageId={pageId}
        spaceId={spaceId}
        editable={editable && isEditMode && !isCheckingLock}
      />
    </Container>
  );
}

type PageBylineProps = {
  creator?: PageUser;
  contributors?: IContributor[];
  readOnly?: boolean;
};

function PageByline({ creator, contributors, readOnly }: PageBylineProps) {
  const { t } = useTranslation();
  const detailsTriggerProps = useAsideTriggerProps("details");

  const otherContributors = (contributors ?? []).filter(
    (c) => c.id !== creator?.id,
  );

  return (
    <Group
      gap="sm"
      className={clsx("print-hide", classes.byline, classes.documentReveal)}
    >
      {creator && (
        <Popover position="bottom-start" shadow="md" width={280} withArrow>
          <Popover.Target>
            <UnstyledButton
              aria-label={t("Created by {{name}}", { name: creator.name })}
            >
              <Group gap={6}>
                <CustomAvatar
                  avatarUrl={creator.avatarUrl}
                  name={creator.name}
                  size={22}
                />
                <Text size="sm" c="dimmed">
                  {t("By {{name}}", { name: creator.name })}
                </Text>
              </Group>
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              {/* kept inside this dropdown so a click on the card doesn't close it */}
              <UserProfilePopover userId={creator.id} withinPortal={false}>
                <UnstyledButton className={classes.bylinePerson}>
                  <Group gap="sm" wrap="nowrap">
                    <CustomAvatar
                      avatarUrl={creator.avatarUrl}
                      name={creator.name}
                      size={36}
                    />
                    <div>
                      <Text size="sm" fw={500}>
                        {creator.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {otherContributors.length === 0
                          ? t("Owner, no contributors")
                          : t("Owner")}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </UserProfilePopover>

              {otherContributors.length > 0 && (
                <>
                  <Divider />
                  <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                    {t("Contributors")}
                  </Text>
                  <Stack gap={0}>
                    {otherContributors.map((contributor) => (
                      <UserProfilePopover
                        key={contributor.id}
                        userId={contributor.id}
                        withinPortal={false}
                      >
                        <UnstyledButton className={classes.bylinePerson}>
                          <Group gap="sm" wrap="nowrap">
                            <CustomAvatar
                              avatarUrl={contributor.avatarUrl}
                              name={contributor.name}
                              size={28}
                            />
                            <Text size="sm">{contributor.name}</Text>
                          </Group>
                        </UnstyledButton>
                      </UserProfilePopover>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}
      <Tooltip label={t("Details")} withArrow openDelay={250}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Details")}
          {...detailsTriggerProps}
        >
          <IconInfoCircle size={20} stroke={1.5} />
        </ActionIcon>
      </Tooltip>

      <PageVerificationBadge readOnly={readOnly} />
    </Group>
  );
}
