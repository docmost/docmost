import { useParams } from "react-router-dom";
import { Center, Grid, Loader, Stack, Title } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useReviewPageQuery } from "@/ee/page-verification/queries/page-verification-query";
import { ReviewActionBar } from "@/ee/page-verification/components/review-action-bar";
import { ReviewerProgress } from "@/ee/page-verification/components/reviewer-progress";
import CommentListWithTabs from "@/features/comment/components/comment-list-with-tabs";
import { useCommentsQuery } from "@/features/comment/queries/comment-query";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { extractPageSlugId } from "@/lib";

export default function ReviewPage() {
  // CommentListWithTabs (reused as-is below) reads its page id from the
  // route's `pageSlug` param via useParams(), so this route must expose the
  // same param name for the comment sidebar to resolve the right page.
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);

  const { data: payload, isLoading } = useReviewPageQuery(pageId);
  // Reviewers must see the content AS OF submission (the pageHistoryId
  // pinned at submit time), not live edits made to the page afterward
  // (design doc §5) — so this fetches the historical snapshot, not the
  // live page.
  const pageHistoryId = payload?.verification?.pageHistoryId ?? undefined;
  const { data: pageHistory } = usePageHistoryQuery(pageHistoryId!);
  const { data: comments } = useCommentsQuery({ pageId: pageId! });
  const currentUser = useAtomValue(currentUserAtom);

  if (isLoading || !payload) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const unresolvedCommentCount =
    comments?.items.filter((c) => !c.parentCommentId && !c.resolvedAt)
      .length ?? 0;
  const myReview = payload.reviews.find(
    (r) => r.verifierId === currentUser?.user?.id,
  );

  return (
    <Grid p="md">
      <Grid.Col span={8}>
        <Stack>
          <Title order={3}>{pageHistory?.title}</Title>
          {pageHistory && (
            <ReadonlyPageEditor
              key={pageHistory.id}
              title={pageHistory.title}
              content={pageHistory.content}
              pageId={pageId}
            />
          )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={4}>
        <Stack h="100%">
          <ReviewerProgress reviews={payload.reviews} />
          {payload.permissions.isReviewer && (
            <ReviewActionBar
              pageId={pageId!}
              unresolvedCommentCount={unresolvedCommentCount}
              myReview={myReview}
            />
          )}
          <CommentListWithTabs />
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
