import { Menu, Tooltip, UnstyledButton } from "@mantine/core";
import {
  IconAt,
  IconCheck,
  IconChevronDown,
  IconLink,
  type IconProps,
} from "@tabler/icons-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { IntegrationDisplay } from "./integration-display";
import classes from "./integration-display-picker.module.css";

export type IntegrationDisplayPickerProps = {
  current: IntegrationDisplay;
  label: string;
  canUseCard: boolean;
  onChange: (display: IntegrationDisplay) => void;
};

const DISPLAY_ORDER: IntegrationDisplay[] = ["card", "mention", "url"];

const DISPLAY_ICONS = {
  card: CardDisplayIcon,
  mention: IconAt,
  url: IconLink,
} as const;

function CardDisplayIcon({ size = 18, stroke = 1.75, ...props }: IconProps) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="13" y2="14" />
    </svg>
  );
}

function useDisplayLabels() {
  const { t } = useTranslation();

  return {
    labels: {
      card: t("Card"),
      mention: t("Mention"),
      url: t("URL"),
    } satisfies Record<IntegrationDisplay, string>,
    getCardUnavailableLabel: () => t("Cards aren't available in this position"),
  };
}

export function IntegrationDisplayPicker({
  current,
  label,
  canUseCard,
  onChange,
}: IntegrationDisplayPickerProps) {
  const { labels, getCardUnavailableLabel } = useDisplayLabels();
  const cardReasonId = useId();
  const optionRefs = useRef<
    Record<IntegrationDisplay, HTMLButtonElement | null>
  >({
    card: null,
    mention: null,
    url: null,
  });

  const cardUnavailableLabel = getCardUnavailableLabel();

  const isUnavailable = (value: IntegrationDisplay) =>
    value === "card" && !canUseCard;

  const choose = (value: IntegrationDisplay) => {
    if (isUnavailable(value)) return;
    onChange(value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: IntegrationDisplay,
  ) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const available = DISPLAY_ORDER.filter(
      (display) => !isUnavailable(display),
    );
    const currentIndex = available.indexOf(value);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? available.length - 1
          : ["ArrowRight", "ArrowDown"].includes(event.key)
            ? (currentIndex + 1 + available.length) % available.length
            : (currentIndex - 1 + available.length) % available.length;
    const next = available[nextIndex];
    if (!next) return;

    optionRefs.current[next]?.focus();
    onChange(next);
  };

  return (
    <div
      className={classes.picker}
      role="radiogroup"
      aria-label={label}
      data-integration-display-picker=""
    >
      {DISPLAY_ORDER.map((value) => {
        const Icon = DISPLAY_ICONS[value];
        const selected = value === current;
        const unavailable = isUnavailable(value);
        const tooltipLabel = unavailable ? cardUnavailableLabel : labels[value];

        return (
          <Tooltip
            key={value}
            label={tooltipLabel}
            withArrow
            withinPortal={false}
            openDelay={350}
          >
            <UnstyledButton
              ref={(element) => {
                optionRefs.current[value] = element;
              }}
              type="button"
              role="radio"
              aria-label={labels[value]}
              aria-checked={selected}
              aria-disabled={unavailable || undefined}
              aria-describedby={unavailable ? cardReasonId : undefined}
              tabIndex={selected ? 0 : -1}
              className={classes.option}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                choose(value);
              }}
              onKeyDown={(event) => handleKeyDown(event, value)}
            >
              <Icon size={18} stroke={1.75} aria-hidden="true" />
            </UnstyledButton>
          </Tooltip>
        );
      })}

      {!canUseCard ? (
        <span id={cardReasonId} className={classes.visuallyHidden}>
          {cardUnavailableLabel}
        </span>
      ) : null}
    </div>
  );
}

export function IntegrationDisplayMenu({
  current,
  label,
  canUseCard,
  onChange,
}: IntegrationDisplayPickerProps) {
  const { labels, getCardUnavailableLabel } = useDisplayLabels();
  const [opened, setOpened] = useState(false);
  const cardReasonId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<
    Record<IntegrationDisplay, HTMLButtonElement | null>
  >({
    card: null,
    mention: null,
    url: null,
  });
  const CurrentIcon = DISPLAY_ICONS[current];
  const cardUnavailableLabel = getCardUnavailableLabel();
  const availableOptions = DISPLAY_ORDER.filter(
    (value) => value !== "card" || canUseCard,
  );
  const initialOption = availableOptions.includes(current)
    ? current
    : availableOptions[0];

  useEffect(() => {
    if (!opened) return;

    let focusFrame = 0;
    const layoutFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        if (initialOption) optionRefs.current[initialOption]?.focus();
      });
    });

    return () => {
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, [initialOption, opened]);

  const openFromKeyboard = () => {
    setOpened(true);
  };

  const closeAndRestoreFocus = () => {
    setOpened(false);
    triggerRef.current?.focus();
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: IntegrationDisplay,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }

    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const currentIndex = availableOptions.indexOf(value);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? availableOptions.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1 + availableOptions.length) %
              availableOptions.length
            : (currentIndex - 1 + availableOptions.length) %
              availableOptions.length;
    const next = availableOptions[nextIndex];
    if (next) optionRefs.current[next]?.focus();
  };

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={6}
      width={190}
      shadow="md"
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton
          ref={triggerRef}
          type="button"
          className={classes.menuTrigger}
          aria-label={`${label}: ${labels[current]}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (
              !opened &&
              ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
            ) {
              event.preventDefault();
              event.stopPropagation();
              openFromKeyboard();
            }
          }}
        >
          <CurrentIcon size={18} stroke={1.75} aria-hidden="true" />
          <IconChevronDown
            className={classes.menuChevron}
            size={13}
            stroke={2}
            aria-hidden="true"
          />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown
        aria-label={label}
        p={4}
        className={classes.menuDropdown}
        data-integration-display-menu-dropdown=""
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={classes.menuLabel}>{label}</div>
        {DISPLAY_ORDER.map((value) => {
          const Icon = DISPLAY_ICONS[value];
          const selected = value === current;
          const unavailable = value === "card" && !canUseCard;

          return (
            <UnstyledButton
              key={value}
              ref={(element) => {
                optionRefs.current[value] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-describedby={unavailable ? cardReasonId : undefined}
              disabled={unavailable}
              className={classes.menuItem}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setOpened(false);
                onChange(value);
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, value)}
            >
              <Icon size={18} stroke={1.75} aria-hidden="true" />
              <span>{labels[value]}</span>
              {selected ? (
                <IconCheck size={16} stroke={2} aria-hidden="true" />
              ) : (
                <span aria-hidden="true" />
              )}
            </UnstyledButton>
          );
        })}

        {!canUseCard ? (
          <span id={cardReasonId} className={classes.visuallyHidden}>
            {cardUnavailableLabel}
          </span>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
}
