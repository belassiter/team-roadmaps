// src/utils/dates.test.js
import { describe, it, expect } from 'vitest';
import { formatDate, parseLocalYMD } from './dates';

describe('Date Utils', () => {
    describe('parseLocalYMD', () => {
        it('parses YYYY-MM-DD correctly without UTC shift', () => {
            const date = parseLocalYMD('2023-01-01');
            expect(date.getFullYear()).toBe(2023);
            expect(date.getMonth()).toBe(0); // Jan is 0
            expect(date.getDate()).toBe(1);
        });
    });

    describe('formatDate', () => {
        it('formats week mode as M/D', () => {
             // Jan 15th
            const date = new Date(2023, 0, 15);
            expect(formatDate(date, 'week')).toBe('1/15');
        });
    });
});
