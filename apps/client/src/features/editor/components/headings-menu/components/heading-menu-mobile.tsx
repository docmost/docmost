import { Accordion, Box } from '@mantine/core';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeadingLink } from '../headings-menu';
import classes from '../headings-menu.module.css';

type HeadingMenuMobileProps = {
	links: HeadingLink[];
	handleScrollToHeading: (element: HTMLElement, accordionHeight: number) => void;
}

export const HeadingMenuMobile: FC<HeadingMenuMobileProps> = (props) => {
	const { t } = useTranslation();

	const [accordionValue, setAccordionValue] = useState<string>('');

	const ref = useRef<HTMLDivElement | null>(null);

	const handleClickLink = (element: HTMLElement) => {
		props.handleScrollToHeading(element, ref.current?.offsetHeight ?? 0);
		setAccordionValue('');
	}

	return (
		<div className={classes.menu_mobile} ref={ref}>
			<Accordion
				value={accordionValue}
				variant='contained'
				onChange={setAccordionValue}
				transitionDuration={0}
			>
				<Accordion.Item value="links">
					<Accordion.Control
					>
						{t('On this page')}
					</Accordion.Control>
					<Accordion.Panel>
						{props.links.map((item, idx) => (
							<Box<'button'>
								component="button"
								onClick={() => handleClickLink(item.element)}
								key={idx}
								className={classes.link}
								title={item.label}
							>
								{item.label}
							</Box>
						))}
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</div>
	)
}
