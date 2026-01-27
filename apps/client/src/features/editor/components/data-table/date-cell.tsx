import React, { useState, useMemo } from 'react';
import { UnstyledButton, Popover, Text, Box } from '@mantine/core';
import { DatePicker } from '../date-picker/date-picker';
import { DatePickerValue, getDateFormat, formatSelectedDate } from '../date-picker/utils';
import classes from './data-table.module.css';
import dayjs from 'dayjs';

interface DateCellProps {
    value: string; // JSON string of DatePickerValue
    onChange: (value: string) => void;
    isEditable: boolean;
}

export function DateCell({ value, onChange, isEditable }: DateCellProps) {
    const [opened, setOpened] = useState(false);

    const dateValue: DatePickerValue = useMemo(() => {
        if (!value) {
            return {
                start: null,
                end: null,
                includeTime: false,
                format: 'full'
            };
        }
        try {
            const parsed = JSON.parse(value);
            return {
                ...parsed,
                start: parsed.start ? new Date(parsed.start) : null,
                end: parsed.end ? new Date(parsed.end) : null
            };
        } catch (e) {
            return {
                start: null,
                end: null,
                includeTime: false,
                format: 'full'
            };
        }
    }, [value]);

    const handleDateChange = (newVal: DatePickerValue) => {
        onChange(JSON.stringify(newVal));
    };

    const handleClear = () => {
        onChange('');
        setOpened(false);
    };

    const displayValue = useMemo(() => {
        if (!dateValue.start) return isEditable ? "Empty" : "";

        const format = getDateFormat(dateValue.format, dateValue.includeTime);
        let str = dayjs(dateValue.start).format(format);

        if (dateValue.end) {
            str += ` → ${dayjs(dateValue.end).format(format)}`;
        }

        return str;
    }, [dateValue, isEditable]);

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom-start"
            offset={0}
            disabled={!isEditable}
            width={320}
            withArrow={false}
            shadow="md"
            withinPortal
        >
            <Popover.Target>
                <UnstyledButton
                    onClick={() => setOpened(o => !o)}
                    style={{
                        width: '100%',
                        minHeight: '100%',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    className={classes.personCellTarget}
                >
                    <Text size="sm" c={dateValue.start ? 'inherit' : 'dimmed'}>
                        {displayValue}
                    </Text>
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown p={0}>
                <DatePicker
                    value={dateValue}
                    onChange={handleDateChange}
                    onClear={handleClear}
                />
            </Popover.Dropdown>
        </Popover>
    );
}
