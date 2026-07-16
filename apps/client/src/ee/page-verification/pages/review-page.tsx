import { useParams } from "react-router-dom";
import { Center, Grid, Loader, Stack, Title } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useReviewPageQuery } from "@/ee/page-verification/queries/page-verification-query";
import { ReviewActionBar } from "@/ee/page-verification/components/review-action-bar";
import { ReviewerProgress } from "@/ee/page-verification/components/reviewer-progress";
import CommentListWithTabs from "@/features/comment/components/comment-list-with-tabs";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { usePageQuery } from "@/features/page/queries/page-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { extractPageSlugId } from "@/lib";

export default function ReviewPage() {
  // CommentListWithTabs (reused as-is below) reads its page id from the
  // route's `pageSlug` param via useParams(), so this route must expose the
  // same param name for the comment sidebar to resolve the right page.
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);

  const { data: payload, isLoading } = useReviewPageQuery(pageId);
  const { data: page } = usePageQuery({ pageId });
  const currentUser = useAtomValue(currentUserAtom);

  if (isLoading || !payload) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const unresolvedCommentCount = 0;
  const myReview = payload.reviews.find(
    (r) => r.verifierId === currentUser?.user?.id,
  );

  return (
    <Grid p="md">
      <Grid.Col span={8}>
        <Stack>
          <Title order={3}>{page?.title}</Title>
          {page && (
            <ReadonlyPageEditor
              key={page.id}
              title={page.title}
              content={page.content}
              pageId={page.id}
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
