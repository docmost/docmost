import { Group, Text, Box } from "@mantine/core";
import React, { useEffect, useState } from "react";
import classes from "./comment.module.css";
import { useAtom, useAtomValue } from "jotai";
import { timeAgo } from "@/lib/time";
import CommentEditor from "@/features/comment/components/comment-editor";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import CommentActions from "@/features/comment/components/comment-actions";
import CommentMenu from "@/features/comment/components/comment-menu";
import { useHover } from "@mantine/hooks";
import {
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from "@/features/comment/queries/comment-query";
import { IComment } from "@/features/comment/types/comment.types";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit";

interface CommentListItemProps {
  comment: IComment;
  pageId: string;
}

function CommentListItem({ comment, pageId }: CommentListItemProps) {
  const { hovered, ref } = useHover();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const editor = useAtomValue(pageEditorAtom);
  const [content, setContent] = useState<string>(comment.content);
  const updateCommentMutation = useUpdateCommentMutation();
  const deleteCommentMutation = useDeleteCommentMutation(comment.pageId);
  const [currentUser] = useAtom(currentUserAtom);
  const emit = useQueryEmit();

  useEffect(() => {
    setContent(comment.content)
  }, [comment]);

  async function handleUpdateComment() {
    try {
      setIsLoading(true);
      const commentToUpdate = {
        commentId: comment.id,
        content: JSON.stringify(content),
      };
      await updateCommentMutation.mutateAsync(commentToUpdate);
      setIsEditing(false);

      emit({
        operation: "invalidateComment",
        pageId: pageId,
      });
    } catch (error) {
      console.error("Failed to update comment:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteComment() {
    try {
      await deleteCommentMutation.mutateAsync(comment.id);
      editor?.commands.unsetComment(comment.id);

      emit({
        operation: "invalidateComment",
        pageId: pageId,
      });
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  }

  function handleCommentClick(comment: IComment) {
    const el = document.querySelector(`.comment-mark[data-comment-id="${comment.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("comment-highlight");
      setTimeout(() => {
        el.classList.remove("comment-highlight");
      }, 3000);
    }
  }

  function handleEditToggle() {
    setIsEditing(true);
  }
  function cancelEdit() {
    setIsEditing(false);
  }

  return (
    <Box ref={ref} pb="xs">
      <Group>
        <CustomAvatar
          size="sm"
          avatarUrl={comment.creator.avatarUrl}
          name={comment.creator.name}
        />

        <div style={{ flex: 1 }}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500} lineClamp={1}>
              {comment.creator.name}
            </Text>

            <div style={{ visibility: hovered ? "visible" : "hidden" }}>
              {/*!comment.parentCommentId && (
                <ResolveComment commentId={comment.id} pageId={comment.pageId} resolvedAt={comment.resolvedAt} />
              )*/}

              {currentUser?.user?.id === comment.creatorId && (
                <CommentMenu
                  onEditComment={handleEditToggle}
                  onDeleteComment={handleDeleteComment}
                />
              )}
            </div>
          </Group>

          <Text size="xs" fw={500} c="dimmed">
            {timeAgo(comment.createdAt)}
          </Text>
        </div>
      </Group>

      <div>
        {!comment.parentCommentId && comment?.selection && (
          <Box className={classes.textSelection} onClick={() => handleCommentClick(comment)}>
            <Text size="sm">{comment?.selection}</Text>
          </Box>
        )}

        {!isEditing ? (
          <CommentEditor defaultContent={content} editable={false} />
        ) : (
          <>
            <CommentEditor
              defaultContent={content}
              editable={true}
              onUpdate={(newContent: any) => setContent(newContent)}
              autofocus={true}
            />

            <CommentActions
              onSave={handleUpdateComment}
              isLoading={isLoading}
              onCancel={cancelEdit}
              isCommentEditor={true}
            />
          </>
        )}
      </div>
    </Box>
  );
}

export default CommentListItem;
