// src/utils/dates.ts

// Helper to format date
export const formatDate = (date: Date, mode: 'day' | 'week' | 'number' | string): string => {
    if (mode === 'day') {
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', weekday: 'short' });
    } else if (mode === 'week') {
        // Display X/YY (Month/Day) - Adding 1 to month because getMonth() is 0-indexed
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return '';
};

// Helper to parse "YYYY-MM-DD" as local date to avoid UTC offsets
export const parseLocalYMD = (str: string): Date => {
    if (!str) return new Date();
    const parts = str.split('-');
    // new Date(y, mIndex, d) handles local time
    // Month is 0-indexed in JS Date constructor
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};
