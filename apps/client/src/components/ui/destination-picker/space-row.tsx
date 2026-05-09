import { useState } from "react";
import { Tooltip } from "@mantine/core";
import { IconChevronRight, IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types";
import { IPage } from "@/features/page/types/page.types";
import { SpaceRole } from "@/lib/types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { PageChildren } from "./page-children";
import classes from "./destination-picker.module.css";

type SpaceRowProps = {
  space: ISpace;
  limit: number;
  selectedId: string | null;
  excludePageId?: string;
  onSelectSpace: (space: ISpace) => void;
  onSelectPage: (page: Partial<IPage>, space: ISpace) => void;
};

export function SpaceRow({
  space,
  limit,
  selectedId,
  excludePageId,
  onSelectSpace,
  onSelectPage,
}: SpaceRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const writable =
    !!space.membership?.role && space.membership.role !== SpaceRole.READER;
  const isSelected = space.id === selectedId;

  const rowClasses = [
    classes.spaceRow,
    isSelected && classes.selected,
    !writable && classes.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  const rowContent = (
    <div
      className={rowClasses}
      onClick={() => writable && onSelectSpace(space)}
    >
      {writable ? (
        <div
          className={`${classes.chevron} ${expanded ? classes.chevronExpanded : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <IconChevronRight size={14} />
        </div>
      ) : (
        <div style={{ width: 20, flexShrink: 0 }} />
      )}

      <CustomAvatar
        name={space.name}
        avatarUrl={space.logo}
        type={AvatarIconType.SPACE_ICON}
        size={22}
      />

      <div className={classes.pageTitle}>{space.name}</div>

      {!writable && (
        <IconLock
          size={14}
          color="var(--mantine-color-gray-5)"
        />
      )}
    </div>
  );

  return (
    <>
      {writable ? (
        rowContent
      ) : (
        <Tooltip
          label={t("You don't have permission to create pages here")}
          position="right"
          withArrow
        >
          <div>{rowContent}</div>
        </Tooltip>
      )}

      {expanded && writable && (
        <PageChildren
          spaceId={space.id}
          depth={1}
          limit={limit}
          selectedId={selectedId}
          excludePageId={excludePageId}
          onSelectPage={(page) => onSelectPage(page, space)}
        />
      )}
    </>
  );
}
