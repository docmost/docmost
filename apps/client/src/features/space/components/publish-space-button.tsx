import { Button } from "@mantine/core";
import React from "react";
import { usePublishMutation, useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useTranslation } from "react-i18next";

interface PublishSpaceButtonProps {
  spaceId: string;
}

export default function PublishSpaceButton({ spaceId }: PublishSpaceButtonProps) {
  const { t } = useTranslation();
  const { data: space } = useSpaceQuery(spaceId);
  const publishSpaceMutation = usePublishMutation();

  const buttonLabel = space?.isPublished ? t("Unpublish space") : t("Publish space")

  const onClick = () => publishSpaceMutation.mutateAsync({
    spaceId,
    publish: !space?.isPublished
  })

  return <Button onClick={onClick}>{buttonLabel}</Button>;
}
