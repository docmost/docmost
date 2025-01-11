import { Box, Group, Text } from "@mantine/core";
import { NodePos, useEditor } from "@tiptap/react";
import clsx from "clsx";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
	return { links, nodes };
};

export const EditorHeadingsMenu: FC<HeadingsMenuProps> = (props) => {
	const { t } = useTranslation();

	const [links, setLinks] = useState<HeadingLink[]>([]);
	const [headingDOMNodes, setHeadingDOMNodes] = useState<HTMLElement[]>([]);
	const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

	const handleScrollToHeading = (element: HTMLElement) => {
		const coords = element.getBoundingClientRect();
		const menuContainer = document.querySelector(`.${classes.menu}`);
		const headerOffset = parseInt(window.getComputedStyle(menuContainer).getPropertyValue('top'));
		const y = coords.top + window.scrollY - element.offsetHeight - headerOffset;
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
			for (const node of headingDOMNodes) {
				const coords = node.getBoundingClientRect();
				if (coords.top >= 0) {
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
		<div className={classes.container}>
			<div className={classes.menu}>
				<Group mb="sm">
					<Text size="md" fw={500}>{t('On this page')}</Text>
				</Group>
				{links.map((item, idx) => (
					<Box<'button'>
						component="button"
						onClick={() => handleScrollToHeading(item.element)}
						key={idx}
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
