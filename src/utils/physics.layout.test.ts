// src/utils/physics.layout.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLayoutOutcome, type PhysicsItem } from './physics';

const CELL_SIZE = 50;

const createItem = (id: number, x: number, y: number, widthUnits: number): PhysicsItem => ({
    id,
    x: x * CELL_SIZE,
    y: y * CELL_SIZE,
    widthUnits,
    name: `Item ${id}`
});

describe('calculateLayoutOutcome', () => {
    // Scenario: [A][B][C] -> Drag B to where C was.
    // A: 0-100 (0, w2)
    // B: 100-200 (2, w2)
    // C: 200-300 (4, w2)
    const itemA = createItem(1, 0, 0, 2);
    const itemB = createItem(2, 2, 0, 2);
    const itemC = createItem(3, 4, 0, 2);
    const allItems = [itemA, itemB, itemC];

    it('Scenario: Backfill then Move to Vacated Spot (No Bump)', () => {
        // Drag Item B (2) to X=4 (Where C was)
        // With Backfill ON.
        
        const result = calculateLayoutOutcome(
            2, // Dragging B
            4 * CELL_SIZE, // Target X
            0,             // Target Y
            allItems,
            CELL_SIZE,
            {
                isBackfillMode: true,
                isBumpMode: false,
                gridWidth: 1000,
                gridHeight: 1000
            }
        );

        // Expectation:
        // 1. Backfill happens first: removing B from 100 creates gap.
        //    C is at 200. C shifts left to 100.
        //    Resulting World: A(0), C(100). Hole at 200.
        // 2. Drag Logic:
        //    Candidate B is at 200 (Target X).
        //    Does B(200) overlap A(0) or C(100)? No.
        //    So B lands at 200.
        
        // Final positions:
        const finalA = result.items.find(i => i.id === 1)!;
        const finalB = result.items.find(i => i.id === 2)!;
        const finalC = result.items.find(i => i.id === 3)!;

        expect(finalA.x).toBe(0);
        expect(finalC.x).toBe(2 * CELL_SIZE); // C moved left 
        expect(finalB.x).toBe(4 * CELL_SIZE); // B moved right (to C's old spot)
        
        expect(result.isValid).toBe(true);
    });

    it('Scenario: Backfill WITH Bump Mode', () => {
        // [A][B][C]
        // Drag B to A's position (0).
        // Backfill ON, Bump ON.
        
        // 1. Backfill removes B(100). Gap at 100.
        //    C(200) moves to 100.
        //    World: A(0), C(100).
        // 2. Drag B to 0. 
        //    Overlap A(0).
        //    Bump logic: B pushes A.
        //    A pushes C? Or A moves to 100?
        //    If A moves to 100, it hits C(100).
        //    C pushes to 200.
        
        // Expected Chain reaction:
        // B -> 0
        // A -> 100
        // C -> 200 (Back exactly where it started?)
        // Let's see.

        const result = calculateLayoutOutcome(
            2, // Dragging B
            0, // Target X (A's spot)
            0, // Target Y
            allItems,
            CELL_SIZE,
            {
                isBackfillMode: true,
                isBumpMode: true,
                gridWidth: 1000,
                gridHeight: 1000
            }
        );

        const finalA = result.items.find(i => i.id === 1)!;
        const finalB = result.items.find(i => i.id === 2)!;
        const finalC = result.items.find(i => i.id === 3)!;

        expect(finalB.x).toBe(0); // B took the spot
        expect(finalA.x).toBe(2 * CELL_SIZE); // A bumped right
        expect(finalC.x).toBe(4 * CELL_SIZE); // C bumped right by A
        
        expect(result.isValid).toBe(true);
    });
});
