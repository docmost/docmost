import { isHttpUrl } from "@docmost/editor-ext";
import { IconWorld } from "@tabler/icons-react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { memo, useState } from "react";
import { formatLinkLocation, selectForEditing } from "./link-preview.utils";
import { useLinkPreviewFill } from "./use-link-preview-fill";
import classes from "./link-mention-view.module.css";

function LinkMentionView(props: NodeViewProps) {
  const { editor, getPos, node } = props;
  const { url, title, icon } = node.attrs;
  const safeUrl = isHttpUrl(url) ? url : "";
  const { isLoading } = useLinkPreviewFill(props);
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const showIcon = isHttpUrl(icon) && icon !== failedIcon;

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }}>
      <a
        href={safeUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={title ? `${title}\n${url}` : url}
        aria-busy={isLoading || undefined}
        className={classes.mention}
        onClick={(event) => selectForEditing(event, editor, getPos)}
      >
        {title && showIcon ? (
          <img
            src={icon}
            alt=""
            width={14}
            height={14}
            decoding="async"
            referrerPolicy="no-referrer"
            className={classes.mentionIcon}
            onError={() => setFailedIcon(icon)}
          />
        ) : (
          <IconWorld size={14} stroke={1.5} className={classes.mentionIcon} />
        )}
        <span className={classes.mentionText}>
          {title || formatLinkLocation(url)}
        </span>
      </a>
    </NodeViewWrapper>
  );
}

export default memo(LinkMentionView);
