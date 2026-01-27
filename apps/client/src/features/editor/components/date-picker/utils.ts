import dayjs from 'dayjs';

export interface DatePickerValue {
    start: Date | null;
    end: Date | null;
    includeTime: boolean;
    format: string;
}

export const getDateFormat = (format: string, includeTime: boolean) => {
    let base = 'MMM D, YYYY';
    if (format === 'month-day-year') base = 'MM/DD/YYYY';
    else if (format === 'day-month-year') base = 'DD/MM/YYYY';
    else if (format === 'year-month-day') base = 'YYYY/MM/DD';

    return includeTime ? `${base} h:mm A` : base;
};

export const getFormatLabel = (format: string) => {
    if (format === 'month-day-year') return 'Month/Day/Year';
    if (format === 'day-month-year') return 'Day/Month/Year';
    if (format === 'year-month-day') return 'Year/Month/Day';
    return 'Full date';
};

export const formatSelectedDate = (value: DatePickerValue) => {
    if (!value.start) return '';

    const format = getDateFormat(value.format, value.includeTime);
    let str = dayjs(value.start).format(format);

    if (value.end) {
        str += ` → ${dayjs(value.end).format(format)}`;
    }

    return str;
};
