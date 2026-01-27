import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Group,
    Text,
    Switch,
    UnstyledButton,
    Divider,
    Menu,
    TextInput,
    ActionIcon
} from '@mantine/core';
import { DatePicker as MantineDatePicker, TimeInput } from '@mantine/dates';
import {
    IconChevronRight,
    IconHelpCircle,
    IconChevronLeft,
    IconChevronRight as IconNext
} from '@tabler/icons-react';
import classes from './date-picker.module.css';
import dayjs from 'dayjs';
import { DatePickerValue, getDateFormat, getFormatLabel, formatSelectedDate } from './utils';


interface DatePickerProps {
    value: DatePickerValue;
    onChange: (value: DatePickerValue) => void;
    onClear: () => void;
}

export function DatePicker({ value, onChange, onClear }: DatePickerProps) {
    const [hasEndDate, setHasEndDate] = useState(!!value.end);

    useEffect(() => {
        setHasEndDate(!!value.end);
    }, [value.end]);

    const handleDateChange = (dates: any) => {
        if (Array.isArray(dates)) {
            onChange({ ...value, start: dates[0], end: dates[1] });
        } else {
            onChange({ ...value, start: dates });
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const timeStr = e.currentTarget.value;
        if (!value.start || !timeStr) return;

        const [hours, minutes] = timeStr.split(':').map(Number);
        const newDate = dayjs(value.start).hour(hours).minute(minutes).toDate();
        onChange({ ...value, start: newDate });
    };

    const toggleEndDate = (val: boolean) => {
        setHasEndDate(val);
        if (!val) {
            onChange({ ...value, end: null });
        }
    };

    const toggleIncludeTime = (val: boolean) => {
        onChange({ ...value, includeTime: val });
    };

    const selectedDateLabel = useMemo(() => {
        return formatSelectedDate(value);
    }, [value]);

    const timeValue = value.start ? dayjs(value.start).format('HH:mm') : '';

    return (
        <Box className={classes.datePickerContainer} p="sm">
            <TextInput
                readOnly
                value={selectedDateLabel}
                placeholder="Empty"
                size="xs"
                variant="filled"
            />

            <Box className={classes.calendarWrapper}>
                <MantineDatePicker
                    type={hasEndDate ? 'range' : 'default'}
                    value={hasEndDate ? [value.start, value.end] : value.start}
                    onChange={handleDateChange as any}
                    size="sm"
                    allowDeselect
                />
            </Box>

            <Divider />

            <Box>
                <Group justify="space-between" className={classes.optionItem} py={4}>
                    <Text size="sm">End date</Text>
                    <Switch
                        size="xs"
                        checked={hasEndDate}
                        onChange={(e) => toggleEndDate(e.currentTarget.checked)}
                    />
                </Group>

                <Menu position="right-start" offset={10} width={200}>
                    <Menu.Target>
                        <UnstyledButton className={classes.optionItem} py={4} style={{ width: '100%' }}>
                            <Group justify="space-between">
                                <Text size="sm">Date format</Text>
                                <Group gap={4}>
                                    <Text size="xs" c="dimmed">{getFormatLabel(value.format)}</Text>
                                    <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
                                </Group>
                            </Group>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => onChange({ ...value, format: 'full' })}>Full date</Menu.Item>
                        <Menu.Item onClick={() => onChange({ ...value, format: 'month-day-year' })}>Month/Day/Year</Menu.Item>
                        <Menu.Item onClick={() => onChange({ ...value, format: 'day-month-year' })}>Day/Month/Year</Menu.Item>
                        <Menu.Item onClick={() => onChange({ ...value, format: 'year-month-day' })}>Year/Month/Day</Menu.Item>
                    </Menu.Dropdown>
                </Menu>

                <Group justify="space-between" className={classes.optionItem} py={4}>
                    <Text size="sm">Include time</Text>
                    <Switch
                        size="xs"
                        checked={value.includeTime}
                        onChange={(e) => toggleIncludeTime(e.currentTarget.checked)}
                    />
                </Group>

                {value.includeTime && (
                    <Box px={8} pb={4}>
                        <TimeInput
                            size="xs"
                            label="Time"
                            value={timeValue}
                            onChange={handleTimeChange}
                        />
                    </Box>
                )}

            </Box>

            <Divider />

            <Box className={classes.footer}>
                <UnstyledButton className={classes.clearButton} onClick={onClear}>
                    Clear
                </UnstyledButton>
            </Box>
        </Box>
    );
}
