import { Box, Group, Text } from "@mantine/core";
import { NodePos, useEditor } from "@tiptap/react";
import clsx from "clsx";
import { FC, useEffect, useState } from "react";
import classes from './headings-menu.module.css';

type HeadingsMenuProps = {
	editor: ReturnType<typeof useEditor>;
};

type HeadingLink = {
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
	return {
		links,
		nodes
	};
};

export const EditorHeadingsMenu: FC<HeadingsMenuProps> = (props) => {
	const [links, setLinks] = useState<HeadingLink[]>([]);
	const [headingDOMNodes, setHeadingDOMNodes] = useState<HTMLElement[]>([]);
	const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

	const handleScrollToHeading = (element: HTMLElement) => {
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
		const handleObserve = (entries: IntersectionObserverEntry[]) => {
			let active: HTMLElement | null = entries[0].target as HTMLElement || null;
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					active = entry.target as HTMLElement;
				}
			})
			setActiveElement(active);
		}
		const observer = new IntersectionObserver(handleObserve, { root: document.body });

		return () => {
			headingDOMNodes.forEach((element) => {
				observer.unobserve(element);
			})
		}
	}, [])

	if (!links.length) {
		return null;
	}

	return (
		<div className={classes.container}>
			<div className={classes.menu}>
				<Group mb="sm">
					<Text size="md" fw={500}>On this page</Text>
				</Group>
				{links.map((item) => (
					<Box<'button'>
						component="button"
						onClick={() => handleScrollToHeading(item.element)}
						key={item.label}
						className={clsx(classes.link, { [classes.linkActive]: item.element === activeElement })}
						style={{ paddingLeft: `calc(${item.level} * var(--mantine-spacing-md))` }}
						title={item.label}
					>
						{item.label}
					</Box>
				))}
			</div>
		</div>
	);
};
