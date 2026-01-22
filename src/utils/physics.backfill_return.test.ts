// src/utils/physics.backfill_return.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLayoutOutcome, type PhysicsItem } from './physics';

const CELL_SIZE = 50;

describe('calculateLayoutOutcome - Backfill Return', () => {
    // Setup: [A][B]. A @ 0. B @ 100. Width 2 (100px).
    const items: PhysicsItem[] = [
        { id: 1, x: 0, y: 0, widthUnits: 2, name: 'A' },
        { id: 2, x: 100, y: 0, widthUnits: 2, name: 'B' }
    ];

    it('should NOT backfill if the dragged item overlaps its original position', () => {
        // Drag A slightly to the right (x=10).
        // It still overlaps A's original position (0-100).
        // Backfill should NOT trigger, so B should stay at 100.
        // If backfill triggered, B would move to 0.
        // Then A(10) checks collision against B(0). Overlap!
        // But if backfill doesn't trigger, B stays at 100. A(10-110) overlaps B(100)?
        // Yes 10-110 overlaps 100-200.
        // So collision is expected if we just move 10px.
        
        // Let's testing returning exactly to 0.
        // Drag A to 0 (No move).
        const result = calculateLayoutOutcome(
            [{ id: 1, targetX: 0, targetY: 0 }],
            items,
            CELL_SIZE,
            { isBackfillMode: true, isBumpMode: false, gridWidth: 1000, gridHeight: 1000 }
        );
        
        // Expect B to be at 100 still.
        const resB = result.items.find(i => i.id === 2);
        expect(resB?.x).toBe(100);
    });

    it('should backfill only when item clears the spot', () => {
        // Drag A to 200 (Clears 0-100).
        // B moves to 0.
        const result = calculateLayoutOutcome(
            [{ id: 1, targetX: 200, targetY: 0 }],
            items,
            CELL_SIZE,
            { isBackfillMode: true, isBumpMode: false, gridWidth: 1000, gridHeight: 1000 }
        );
        
        const resB = result.items.find(i => i.id === 2);
        expect(resB?.x).toBe(0);
    });
});
