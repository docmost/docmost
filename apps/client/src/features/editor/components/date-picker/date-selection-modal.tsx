import React, { useState } from 'react';
import { DatePicker } from './date-picker';
import { DatePickerValue } from './utils';
import { Box, Button, Group } from '@mantine/core';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';

interface DateSelectionModalProps {
    initialValue: DatePickerValue;
    onConfirm: (value: DatePickerValue) => void;
}

export function DateSelectionModal({ initialValue, onConfirm }: DateSelectionModalProps) {
    const [value, setValue] = useState<DatePickerValue>(initialValue);

    const handleConfirm = () => {
        onConfirm(value);
        modals.closeAll();
    };

    const handleClear = () => {
        // Clear logic if needed inside modal
        setValue({
            start: null,
            end: null,
            includeTime: false,
            format: 'full'
        });
    };

    return (
        <Box>
            <DatePicker
                value={value}
                onChange={setValue}
                onClear={handleClear}
            />
            <Group justify="flex-end" mt="md" px="sm" pb="sm">
                <Button variant="subtle" color="gray" onClick={() => modals.closeAll()}>
                    Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={!value.start}>
                    Insert
                </Button>
            </Group>
        </Box>
    );
}
