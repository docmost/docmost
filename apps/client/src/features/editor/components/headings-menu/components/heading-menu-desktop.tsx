import { Box, Drawer, Group, ScrollArea, Text } from '@mantine/core';
import clsx from 'clsx';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HeadingLink } from '../headings-menu';
import classes from '../headings-menu.module.css';

type HeadingMenuDesktopProps = {
	links: HeadingLink[];
	activeElement: HTMLElement;
	isFullScreen: boolean;
	isOpenedFullScreenDrawer: boolean;
	handleScrollToHeading: (element: HTMLElement) => void;
	onCloseFullPageWidthDrawer: () => void;
}

type OverlayProps = {
	opened: boolean;
	onClose: () => void;
	isFullScreen: boolean;
	renderSlot: ReactNode;
};

const RenderOverlay: FC<OverlayProps> = (props) => {
	const { t } = useTranslation();

	if (props.isFullScreen) {
		return (
			<Drawer
				size='xs'
				position='right'
				onClose={props.onClose}
				opened={props.opened}
			>
				<Group mb="sm">
					<Text size="md" fw={500}>{t('On this page')}</Text>
				</Group>
				<ScrollArea
					style={{ height: "85vh" }}
					scrollbarSize={5}
					type="scroll"
				>
					{props.renderSlot}
				</ScrollArea>
			</Drawer>
		)
	}

	return (
		<div className={classes.container}>
			<Group mb="sm">
				<Text size="md" fw={500}>{t('On this page')}</Text>
			</Group>
			{props.renderSlot}
		</div>
	)
}


export const HeadingMenuDesktop: FC<HeadingMenuDesktopProps> = (props) => {
	return (
		<RenderOverlay
			opened={props.isOpenedFullScreenDrawer}
			isFullScreen={props.isFullScreen}
			onClose={props.onCloseFullPageWidthDrawer}
			renderSlot={(
				<div className={clsx(classes.menu_desktop, { [classes.in_editor_page]: !props.isFullScreen })}>
					{props.links.map((item, idx) => (
						<Box<'button'>
							component="button"
							onClick={() => props.handleScrollToHeading(item.element)}
							key={idx}
							className={clsx(classes.link, { [classes.linkActive]: item.element === props.activeElement })}
							style={{ paddingLeft: `calc(${item.level} * var(--mantine-spacing-md))` }}
							title={item.label}
						>
							{item.label}
						</Box>
					))}
				</div>
			)}
		/>
	)
};
