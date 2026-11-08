import { Button } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { usePageCover } from "@/features/page-cover/hooks/use-page-cover.ts";
import {
  pickRandomGradient,
  toCoverValue,
} from "@/features/page-cover/page-cover.utils.ts";

type AddCoverButtonProps = {
  slugId: string;
  className?: string;
};

export function AddCoverButton({ slugId, className }: AddCoverButtonProps) {
  const { data: page } = usePageQuery({ pageId: slugId });
  if (!page) return null;
  return <AddCoverAction page={page} className={className} />;
}

function AddCoverAction({ page, className }: { page: IPage; className?: string }) {
  const { t } = useTranslation();
  const { updateCover } = usePageCover(page);

  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      fw={500}
      className={className}
      leftSection={<IconPhoto size={16} stroke={1.75} />}
      onClick={() =>
        updateCover({
          coverPhoto: toCoverValue(pickRandomGradient(page.coverPhoto)),
        })
      }
    >
      {t("Add cover")}
    </Button>
  );
}
