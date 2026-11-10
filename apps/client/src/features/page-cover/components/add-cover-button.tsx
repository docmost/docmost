import { useEffect, useRef } from "react";
import { Button } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { IPage } from "@/features/page/types/page.types.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { usePageCover } from "@/features/page-cover/hooks/use-page-cover.ts";
import { coverFocusRequestAtom } from "@/features/page-cover/atoms/page-cover-atoms.ts";
import { COVER_FOCUS_REQUEST_TTL } from "@/features/page-cover/page-cover.constants.ts";
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
  const [focusRequest, setFocusRequest] = useAtom(coverFocusRequestAtom);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusRequest?.pageId !== page.id) return;
    if (focusRequest.target !== "add-cover") return;
    setFocusRequest(null);
    if (Date.now() - focusRequest.requestedAt > COVER_FOCUS_REQUEST_TTL) return;
    buttonRef.current?.focus();
  }, [focusRequest]);

  const addCover = () => {
    // this button disappears with the new cover, so focus moves to its controls
    setFocusRequest({
      pageId: page.id,
      target: "change-cover",
      requestedAt: Date.now(),
    });
    updateCover({
      coverPhoto: toCoverValue(pickRandomGradient(page.coverPhoto)),
    });
  };

  return (
    <Button
      ref={buttonRef}
      variant="subtle"
      color="gray"
      size="compact-sm"
      fw={500}
      className={className}
      leftSection={<IconPhoto size={16} stroke={1.75} />}
      onClick={addCover}
    >
      {t("Add cover")}
    </Button>
  );
}
