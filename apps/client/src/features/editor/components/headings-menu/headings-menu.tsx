import { NodePos, useEditor } from "@tiptap/react";
import { FC, useEffect, useState } from "react";
import { HeadingMenuDesktop } from "./components/heading-menu-desktop";
import { HeadingMenuMobile } from "./components/heading-menu-mobile";
import classes from './headings-menu.module.css';

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

	const handleScrollToHeading = (element: HTMLElement, accordionHeight = 0) => {
		const coords = element.getBoundingClientRect();
		const menuContainer = document.querySelector(`.${classes.menu_desktop}`);
		const headerOffset = parseInt(window.getComputedStyle(menuContainer).getPropertyValue('top'));
		const y = coords.top + window.scrollY - element.offsetHeight - headerOffset - accordionHeight;
		window.scrollTo({ top: y, behavior: 'smooth' });
	}

	useEffect(() => {
		const handleUpdate = () => {
			const result = recalculateLinks(props.editor.$nodes('heading'));
			setLinks(result.links);
			setHeadingDOMNodes(result.nodes);
		};
		props.editor.on('update', handleUpdate);

		return () => {
			props.editor.off('update', handleUpdate);
		}
	}, [])

	useEffect(() => {
		const handleScroll = () => {
			const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
			for (const node of headingDOMNodes) {
				const coords = node.getBoundingClientRect();

				// more 33% percents screen
				if (coords.top >= 0 && viewportHeight / coords.top > 3) {
					setActiveElement(node);
					return;
				}
			}
		}
		document.addEventListener('scroll', handleScroll, false);
		return () => {
			document.removeEventListener('scroll', handleScroll, false);
		}
	}, [headingDOMNodes, props.editor])

	if (!links.length) {
		return null;
	}

	return (
		<>
			<HeadingMenuDesktop
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
