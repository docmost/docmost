import { Group, Text, Box, Badge } from "@mantine/core";
import React, { useEffect, useState } from "react";
import classes from "./comment.module.css";
import { useAtom, useAtomValue } from "jotai";
import { timeAgo } from "@/lib/time";
import CommentEditor from "@/features/comment/components/comment-editor";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import CommentActions from "@/features/comment/components/comment-actions";
import CommentMenu from "@/features/comment/components/comment-menu";
import { useIsCloudEE } from "@/hooks/use-is-cloud-ee";
import ResolveComment from "@/ee/comment/components/resolve-comment";
import { useHover } from "@mantine/hooks";
import {
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from "@/features/comment/queries/comment-query";
import { useResolveCommentMutation } from "@/ee/comment/queries/comment-query";
import { IComment } from "@/features/comment/types/comment.types";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { useTranslation } from "react-i18next";

interface CommentListItemProps {
  comment: IComment;
  pageId: string;
  canComment: boolean;
  userSpaceRole?: string;
}

function CommentListItem({
  comment,
  pageId,
  canComment,
  userSpaceRole,
}: CommentListItemProps) {
  const { t } = useTranslation();
  const { hovered, ref } = useHover();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const editor = useAtomValue(pageEditorAtom);
  const [content, setContent] = useState<string>(comment.content);
  const updateCommentMutation = useUpdateCommentMutation();
  const deleteCommentMutation = useDeleteCommentMutation(comment.pageId);
  const resolveCommentMutation = useResolveCommentMutation();
  const [currentUser] = useAtom(currentUserAtom);
  const emit = useQueryEmit();
  const isCloudEE = useIsCloudEE();

  useEffect(() => {
    setContent(comment.content);
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

  async function handleResolveComment() {
    if (!isCloudEE) return;
    
    try {
      const isResolved = comment.resolvedAt != null;
      
      await resolveCommentMutation.mutateAsync({
        commentId: comment.id,
        pageId: comment.pageId,
        resolved: !isResolved,
      });

      if (editor) {
        editor.commands.setCommentResolved(comment.id, !isResolved);
      }

      emit({
        operation: "invalidateComment",
        pageId: pageId,
      });
    } catch (error) {
      console.error("Failed to toggle resolved state:", error);
    }
  }

  function handleCommentClick(comment: IComment) {
    const el = document.querySelector(
      `.comment-mark[data-comment-id="${comment.id}"]`,
    );
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
              {!comment.parentCommentId && canComment && isCloudEE && (
                <ResolveComment
                  editor={editor}
                  commentId={comment.id}
                  pageId={comment.pageId}
                  resolvedAt={comment.resolvedAt}
                />
              )}

              {(currentUser?.user?.id === comment.creatorId || userSpaceRole === 'admin') && (
                <CommentMenu
                  onEditComment={handleEditToggle}
                  onDeleteComment={handleDeleteComment}
                  onResolveComment={handleResolveComment}
                  canEdit={currentUser?.user?.id === comment.creatorId}
                  isResolved={comment.resolvedAt != null}
                  isParentComment={!comment.parentCommentId}
                />
              )}
            </div>
          </Group>

          <Group gap="xs">
            <Text size="xs" fw={500} c="dimmed">
              {timeAgo(comment.createdAt)}
            </Text>
          </Group>
        </div>
      </Group>

      <div>
        {!comment.parentCommentId && comment?.selection && (
          <Box
            className={classes.textSelection}
            onClick={() => handleCommentClick(comment)}
          >
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
              onSave={handleUpdateComment}
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
