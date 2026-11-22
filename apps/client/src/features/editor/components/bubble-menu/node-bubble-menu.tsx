import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { useCallback, type ComponentProps } from "react";

type ShouldShow = NonNullable<BubbleMenuProps["shouldShow"]>;
type NodeBubbleMenuProps = ComponentProps<typeof BubbleMenu> & {
  shouldShow: ShouldShow;
};

export function NodeBubbleMenu({ shouldShow, ...props }: NodeBubbleMenuProps) {
  const shouldShowWhenFocused = useCallback<ShouldShow>(
    (context) => {
      const { view, element } = context;
      const activeElement = view.root.activeElement;
      // The body editor already has a selection while the page title has focus.
      return (
        (view.dom.contains(activeElement) || element.contains(activeElement)) &&
        shouldShow(context)
      );
    },
    [shouldShow],
  );

  return <BubbleMenu {...props} shouldShow={shouldShowWhenFocused} />;
}
