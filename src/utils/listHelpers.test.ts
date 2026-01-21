// src/utils/listHelpers.test.js
import { describe, it, expect } from 'vitest';
import { filterItems, sortItems } from './listHelpers';

describe('List Helpers', () => {
    const mockItems = [
        { id: 1, name: 'Alpha Task', x: 100, y: 50, color: '#ff0000' },
        { id: 2, name: 'Beta Task', x: 0, y: 100, color: '#00ff00' },
        { id: 3, name: 'Gamma Job', x: 200, y: 0, color: '#0000ff' },
    ];

    describe('filterItems', () => {
        it('returns all items if search query is empty', () => {
            const result = filterItems(mockItems, '');
            expect(result).toHaveLength(3);
        });

        it('filters by name (case insensitive)', () => {
            const result = filterItems(mockItems, 'alpha');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alpha Task');
        });

        it('filters partial matches', () => {
            const result = filterItems(mockItems, 'task');
            expect(result).toHaveLength(2); // Alpha Task, Beta Task
        });
    });

    describe('sortItems', () => {
        it('sorts by name ascending', () => {
            const result = sortItems(mockItems, 'name', 'asc');
            expect(result[0].name).toBe('Alpha Task');
            expect(result[2].name).toBe('Gamma Job');
        });

        it('sorts by name descending', () => {
            const result = sortItems(mockItems, 'name', 'desc');
            expect(result[0].name).toBe('Gamma Job');
        });

        it('sorts by x (Start) ascending', () => {
            const result = sortItems(mockItems, 'x', 'asc');
            expect(result[0].id).toBe(2); // x: 0
            expect(result[1].id).toBe(1); // x: 100
            expect(result[2].id).toBe(3); // x: 200
        });

        it('sorts by y (Row) ascending', () => {
            const result = sortItems(mockItems, 'y', 'asc');
            expect(result[0].id).toBe(3); // y: 0
            expect(result[1].id).toBe(1); // y: 50
        });
    });
});
