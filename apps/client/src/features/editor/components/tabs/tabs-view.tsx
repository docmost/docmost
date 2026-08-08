import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Tabs, TextInput } from "@mantine/core";

export default function TabsView(props: NodeViewProps) {
  const { node, editor, getPos } = props;
  const isEditable = editor.isEditable;
  const allowFocusRef = useRef(false);

  const tabs = useMemo(() => {
    return Array.from({ length: node.childCount }, (_, index) => {
      const labelNode = node.child(index)?.child(0);
      const labelText = labelNode?.textContent;
      const labelId = node.child(index)?.attrs?.id;

      return {
        label: labelText ?? "",
        id: labelId ?? index,
      };
    });
  }, [node]);

  const activeTab = clampIndex(node.attrs.activeTab);
  const [activeLabel, setActiveLabel] = useState(tabs[activeTab].label ?? "");

  useEffect(() => {
    setActiveLabel(tabs[activeTab].label);
  }, [activeTab, tabs]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const previous = document.activeElement as HTMLElement | null;
    const input = event.currentTarget;

    if (!previous?.contains(input)) {
      allowFocusRef.current = true;
      return;
    }

    allowFocusRef.current = true;
  }, []);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (!allowFocusRef.current || !isEditable) {
        event.preventDefault();
        event.target.blur();
      }
    },
    [isEditable]
  );

  const handleBlur = useCallback(() => {
    allowFocusRef.current = false;
  }, []);

  const commitLabel = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const label = event.currentTarget.value;
      setActiveLabel(label);

      if (label === tabs[activeTab].label) return;
      if (typeof getPos === "function") {
        editor.commands.updateTabLabel?.(activeTab, label, getPos());
      }
    },
    [activeTab, editor, getPos, tabs]
  );

  const handleLabelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    []
  );

  return (
    <NodeViewWrapper data-type="tabs">
      <Tabs value={String(activeTab)}>
        <Tabs.List style={{ marginBottom: 10 }}>
          {tabs.map(({ label, id }, index) => (
            <Tabs.Tab
              key={id}
              value={index.toString()}
              onFocus={(event) => event.currentTarget.blur()}
              onClick={(e) => {
                e.preventDefault();
                if (typeof getPos === "function") {
                  editor.commands.setActiveTab?.(index, getPos());
                }
              }}
            >
              <TextInput
                aria-label="Edit tab label"
                onMouseDown={handleMouseDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={commitLabel}
                onKeyDown={handleLabelKeyDown}
                variant="unstyled"
                size="xs"
                value={
                  index === activeTab && allowFocusRef.current ? activeLabel : label
                }
                styles={{
                  input: {
                    minWidth: 80,
                    padding: 0,
                    cursor: "pointer",
                  },
                }}
              />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <div className="dm-tabs__content">
        <NodeViewContent as="div" />
      </div>
    </NodeViewWrapper>
  );
}

const clampIndex = (value: unknown, length = Number.MAX_SAFE_INTEGER) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(parsed), length - 1));
};
