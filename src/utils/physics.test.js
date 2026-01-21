// src/utils/physics.test.js
import { describe, it, expect } from 'vitest';
import { checkCollision, findClosestValidPosition } from './physics';

const CELL = 50;

describe('Physics Utils', () => {
    describe('checkCollision', () => {
        it('detects a direct overlap', () => {
            const existing = [{ id: 1, x: 0, y: 0, widthUnits: 2 }];
            const candidate = { id: 2, x: 0, y: 0, widthUnits: 2 };
            expect(checkCollision(candidate, existing, CELL)).toBe(true);
        });

        it('ignores collision with self', () => {
            const items = [{ id: 1, x: 0, y: 0, widthUnits: 2 }];
            const candidate = { id: 1, x: 0, y: 0, widthUnits: 2 };
            expect(checkCollision(candidate, items, CELL)).toBe(false);
        });

        it('detects partial horizontal overlap', () => {
            // Item 1: 0-100px
            const existing = [{ id: 1, x: 0, y: 0, widthUnits: 2 }];
            // Item 2: 50-150px (starts in middle of Item 1)
            const candidate = { id: 2, x: 50, y: 0, widthUnits: 2 };
            expect(checkCollision(candidate, existing, CELL)).toBe(true);
        });

        it('allows non-overlapping items side by side', () => {
            const existing = [{ id: 1, x: 0, y: 0, widthUnits: 1 }]; // 0-50px
            const candidate = { id: 2, x: 50, y: 0, widthUnits: 1 }; // 50-100px
            expect(checkCollision(candidate, existing, CELL)).toBe(false);
        });
    });

    describe('findClosestValidPosition', () => {
        it('returns target if no collision exists', () => {
            const items = [{ id: 1, x: 0, y: 0, widthUnits: 1 }];
            const targetX = 100;
            const targetY = 0;
            
            const result = findClosestValidPosition(2, items, targetX, targetY, 1, CELL, 1000, 500);
            expect(result).toEqual({ x: 100, y: 0 });
        });

        it('finds nearest neighbor when blocked', () => {
            // Block 0,0
            const items = [{ id: 1, x: 0, y: 0, widthUnits: 1 }];
            
            // Try to drop at 0,0
            // Neighbors are:
            // (50, 0) - Right
            // (0, 50) - Down
            // (50, 50) - Diagonal
            
            // The algorithm sweeps radius 1. It should find (50,0) or (0,50) first.
            const result = findClosestValidPosition(2, items, 0, 0, 1, CELL, 1000, 500);
            
            // Expect it to NOT be 0,0
            expect(result).not.toEqual({ x: 0, y: 0 });
            // Expect it to be a valid grid coordinate
            expect(result.x % CELL).toBe(0);
            expect(result.y % CELL).toBe(0);
            // Expect it to not collide
            expect(checkCollision({ ...result, id: 2, widthUnits: 1 }, items, CELL)).toBe(false);
        });
    });
});
