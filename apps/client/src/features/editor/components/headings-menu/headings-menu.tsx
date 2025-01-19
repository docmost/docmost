import { NodePos, useEditor } from "@tiptap/react";
import { FC, useEffect, useRef, useState } from "react";
import { HeadingMenuDesktop } from "./components/heading-menu-desktop";
import { HeadingMenuMobile } from "./components/heading-menu-mobile";

type HeadingsMenuProps = {
	editor: ReturnType<typeof useEditor>;
};

export type HeadingLink = {
	label: string;
	level: number;
	element: HTMLElement;
}

const recalculateLinks = (nodePos: NodePos[]) => {
	const nodes: HTMLElement[] = [];
	const links: HeadingLink[] = Array.from(nodePos).reduce<HeadingLink[]>((acc, item) => {
		const label = item.node.textContent;
		if (label.length) {
			acc.push({
				label,
				level: Number(item.node.attrs.level),
				element: item.element,
			});
			nodes.push(item.element);
		}
		return acc;
	}, [])
	return { links, nodes };
};

export const EditorHeadingsMenu: FC<HeadingsMenuProps> = (props) => {
	const [links, setLinks] = useState<HeadingLink[]>([]);
	const [headingDOMNodes, setHeadingDOMNodes] = useState<HTMLElement[]>([]);
	const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

	const desktopMenuRef = useRef<HTMLDivElement | null>(null);

	const handleScrollToHeading = (element: HTMLElement, accordionHeight = 0) => {
		const coords = element.getBoundingClientRect();
		const headerOffset = parseInt(window.getComputedStyle(desktopMenuRef.current).getPropertyValue('top'));
		const y = coords.top + window.scrollY - element.offsetHeight - headerOffset - accordionHeight;
		window.scrollTo({ top: y, behavior: 'smooth' });
	}

	const handleUpdate = () => {
		const result = recalculateLinks(props.editor.$nodes('heading'));
		setLinks(result.links);
		setHeadingDOMNodes(result.nodes);
	};

	useEffect(() => {
		props.editor.on('update', handleUpdate);

		return () => {
			props.editor.off('update', handleUpdate);
		}
	}, [props.editor])

	useEffect(() => {
		handleUpdate();
	}, [])

	useEffect(() => {
		const observeHandler = (entries: IntersectionObserverEntry[]) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					setActiveElement(entry.target as HTMLElement);
				}
			});
		};

		let headerOffset = 0;
		if (desktopMenuRef.current) {
			headerOffset = parseInt(window.getComputedStyle(desktopMenuRef.current).getPropertyValue('top'))
		};
		const observerOptions: IntersectionObserverInit = {
			rootMargin: `-${headerOffset}px 0px -85% 0px`,
			threshold: 0,
			root: null,
		};
		const observer = new IntersectionObserver(observeHandler, observerOptions);

		headingDOMNodes.forEach((heading) => {
			observer.observe(heading);
		});
		return () => {
			headingDOMNodes.forEach(heading => {
				observer.unobserve(heading);
			});
		}
	}, [headingDOMNodes, props.editor])

	if (!links.length) {
		return null;
	}

	return (
		<>
			<HeadingMenuDesktop
				ref={desktopMenuRef}
				links={links}
				activeElement={activeElement}
				handleScrollToHeading={handleScrollToHeading}
			/>
			<HeadingMenuMobile
				links={links}
				handleScrollToHeading={handleScrollToHeading}
			/>
		</>
	);
};
