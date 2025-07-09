import { ActionIcon, CopyButton, Flex, Group, Tooltip } from "@mantine/core";
import { IconAnchor, IconCheck, IconCopy } from "@tabler/icons-react";
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ElementType, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import classes from "./heading.module.css";

const generateSlug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export default function HeadingView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const [combinedId, setCombinedId] = useState("");
  const [url, setUrl] = useState("");
  const [showAnchorButton, setShowAnchorButton] = useState(false);

  const tag: ElementType = `h${node.attrs.level}` as ElementType;
  const nodeId = node.attrs.nodeId;

  useEffect(() => {
    if (nodeId) {
      const text = node.textContent || "";
      const textSlug = generateSlug(text);
      const combined = textSlug ? `${textSlug}-${nodeId}` : nodeId;
      setCombinedId(combined);

      const baseUrl = window.location.href.split("#")[0];
      setUrl(`${baseUrl}#${combined}`);
    }
  }, [nodeId, node.content]);

  return (
    <NodeViewWrapper
      as={tag}
      id={combinedId}
      className={classes.anchorScrollMargin}
      onMouseEnter={() => setShowAnchorButton(true)}
      onMouseLeave={() => setShowAnchorButton(false)}
    >
      <Flex gap="sm" justify="flex-start" align="center">
        <NodeViewContent as="span" />
        {showAnchorButton && nodeId && combinedId && node.textContent && (
          <CopyButton value={url} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip disabled={!copied} label={t("Anchor link copied")} openDelay={300} withArrow position="bottom">
                <ActionIcon
                  color={copied ? "teal" : "gray"}
                  variant="subtle"
                  size="sm"
                  onClick={copy}
                >
                  {copied ? <IconCheck size={16} /> : <IconAnchor size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </Flex>
    </NodeViewWrapper>
  );
}
