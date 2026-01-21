// src/utils/gridConverters.test.js
import { describe, it, expect } from 'vitest';
import { getGridIndexFromDate, getDateFromGridIndex } from './gridConverters';

describe('Grid Converters', () => {
    const startDateStr = '2026-01-01'; // A Thursday

    describe('getGridIndexFromDate', () => {
        it('calculates index 0 for the start date', () => {
            expect(getGridIndexFromDate('2026-01-01', startDateStr, 'day')).toBe(0);
        });

        it('calculates index 1 for the next day in day mode', () => {
            expect(getGridIndexFromDate('2026-01-02', startDateStr, 'day')).toBe(1);
        });

        it('calculates negative index for previous days', () => {
            expect(getGridIndexFromDate('2025-12-31', startDateStr, 'day')).toBe(-1);
        });

        it('calculates index correctly for weeks', () => {
            // Jan 1 2026 is Thursday.
            // If mode is week, the axis usually snaps strict start to preceding Monday (Dec 29).
            // But let's verify assumptions. The converter needs to align with the Axis logic.
            // If the user picks a date, we probably want to find which "Week Column" that date falls into.
            
            // Week 0: Dec 29 - Jan 4
            // Week 1: Jan 5 - Jan 11
            
            expect(getGridIndexFromDate('2026-01-01', startDateStr, 'week')).toBe(0); 
            expect(getGridIndexFromDate('2026-01-05', startDateStr, 'week')).toBe(1); // Next Monday
        });
    });

    describe('getDateFromGridIndex', () => {
        it('returns start date for index 0', () => {
            const date = getDateFromGridIndex(0, startDateStr, 'day');
            expect(date.toISOString().slice(0, 10)).toBe('2026-01-01');
        });

        it('returns next day for index 1 in day mode', () => {
            const date = getDateFromGridIndex(1, startDateStr, 'day');
            expect(date.toISOString().slice(0, 10)).toBe('2026-01-02');
        });
        
        it('returns start of week for week mode', () => {
             // If Jan 1 is Thurs, Week 0 start (Monday) is Dec 29 2025
             const date = getDateFromGridIndex(0, startDateStr, 'week');
             expect(date.toISOString().slice(0, 10)).toBe('2025-12-29');
        });
    });
});
