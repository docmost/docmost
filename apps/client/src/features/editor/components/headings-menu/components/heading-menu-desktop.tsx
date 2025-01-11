import { Box, Group, Text } from '@mantine/core';
import clsx from 'clsx';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { HeadingLink } from '../headings-menu';
import classes from '../headings-menu.module.css';

type HeadingMenuDesktopProps = {
	links: HeadingLink[];
	activeElement: HTMLElement;
	handleScrollToHeading: (element: HTMLElement) => void;
}

export const HeadingMenuDesktop: FC<HeadingMenuDesktopProps> = (props) => {
	const { t } = useTranslation();
	return (
		<div className={classes.container}>
			<div className={classes.menu_desktop}>
				<Group mb="sm">
					<Text size="md" fw={500}>{t('On this page')}</Text>
				</Group>
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
		</div>
	)
}
