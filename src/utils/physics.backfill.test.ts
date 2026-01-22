import { describe, it, expect } from 'vitest';
import { resolveBackfill, type PhysicsItem } from './physics';

const CELL_SIZE = 50;

const createItem = (id: number, x: number, y: number, widthUnits: number): PhysicsItem => ({
    id,
    x: x * CELL_SIZE,
    y: y * CELL_SIZE,
    widthUnits,
    name: `Item ${id}`
});

describe('resolveBackfill', () => {
    it('shifts a single adjacent item into the gap', () => {
        // Gap at 0 (width 2). Item at 2 (width 2).
        // [Gap][Item]
        
        const item1 = createItem(1, 2, 0, 2); // Start at X=100
        const items = [item1];
        
        const gapX = 0;
        const gapY = 0;
        const gapWidth = 2; // 100px
        
        const result = resolveBackfill(gapX, gapY, gapWidth, items, CELL_SIZE);
        
        const newItem1 = result.find(i => i.id === 1)!;
        expect(newItem1.x).toBe(0); // Should move to 0
    });

    it('shifts a chain of connected items', () => {
        // [Gap][Item1][Item2]
        // Gap width 2. Item1 width 2. Item2 width 2.
        
        const item1 = createItem(1, 2, 0, 2); // X=100
        const item2 = createItem(2, 4, 0, 2); // X=200
        
        const items = [item1, item2];
        const result = resolveBackfill(0, 0, 2, items, CELL_SIZE);
        
        const r1 = result.find(i => i.id === 1)!;
        const r2 = result.find(i => i.id === 2)!;
        
        expect(r1.x).toBe(0);
        expect(r2.x).toBe(2 * CELL_SIZE); // 100
    });

    it('stops at a gap in the chain', () => {
        // [Hole 2][Item 2][Gap 1][Item 2]
        // Should move first item, but not second (if strictly adjacent rule applies)
        
        const item1 = createItem(1, 2, 0, 2); // X=100. Ends 200.
        const item2 = createItem(2, 5, 0, 2); // X=250. Starts at 250. Gap 200-250 (Size 1).
        
        const items = [item1, item2];
        const result = resolveBackfill(0, 0, 2, items, CELL_SIZE);
        
        const r1 = result.find(i => i.id === 1)!;
        const r2 = result.find(i => i.id === 2)!;
        
        expect(r1.x).toBe(0); // Moved
        expect(r2.x).toBe(5 * CELL_SIZE); // Did NOT move
    });

    it('does not affect items in other rows', () => {
        const item1 = createItem(1, 2, 1, 2); // Row 1
        const items = [item1];
        
        // Gap in Row 0
        const result = resolveBackfill(0, 0, 2, items, CELL_SIZE);
        
        expect(result[0].x).toBe(item1.x);
    });

    it('does not move items that are not adjacent to start with', () => {
        // [Hole 2][Gap 1][Item 2]
        const item1 = createItem(1, 3, 0, 2); // Starts at 150. Gap ends at 100.
        const items = [item1];
        
        const result = resolveBackfill(0, 0, 2, items, CELL_SIZE);
        
        expect(result[0].x).toBe(item1.x);
    });
});
