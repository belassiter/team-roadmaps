
import { describe, it, expect } from 'vitest';
import { resolveBumps, type PhysicsItem } from './physics';

const CELL_SIZE = 50;

describe('resolveBumps', () => {
    it('should return the candidate at the given position if no collision', () => {
        // [ candidate ] [ item2 ]
        const items: PhysicsItem[] = [
            { id: 1, x: 0, y: 0, widthUnits: 2 },
            { id: 2, x: 200, y: 0, widthUnits: 2 }
        ];
        const candidate: PhysicsItem = { id: 1, x: 50, y: 0, widthUnits: 2 };
        
        const result = resolveBumps([candidate], items, CELL_SIZE);
        
        const resCandidate = result.find(i => i.id === 1);
        const resItem2 = result.find(i => i.id === 2);
        
        expect(resCandidate).toBeDefined();
        expect(resCandidate?.x).toBe(50);
        expect(resItem2?.x).toBe(200); // Should not move
    });

    it('should bump an item to the right if overlapped from the left', () => {
        // [ candidate ] -> [ item2 ]
        // Candidate moves overlaps item2's left side.
        // Item2 starts at 100 (width=100/2units). Center = 150.
        // Candidate moves to 80. Right edge = 180. Overlap!
        // Candidate Center = 130. 130 < 150 -> Push Right.
        
        const items: PhysicsItem[] = [
            { id: 1, x: 0, y: 0, widthUnits: 2 },
            { id: 2, x: 100, y: 0, widthUnits: 2 }
        ];
        
        const candidate: PhysicsItem = { id: 1, x: 80, y: 0, widthUnits: 2 }; 
        // candidate ends at 180. overlap with 2 (starts 100).
        
        const result = resolveBumps([candidate], items, CELL_SIZE);
        
        const resItem2 = result.find(i => i.id === 2);
        
        // Should be pushed to candidate.x + candidate.width = 80 + 100 = 180.
        expect(resItem2?.x).toBe(180);
    });

    it('should chain bump items', () => {
        // [ 1 ] [ 2 ] [ 3 ]
        // 1 bumps 2, 2 bumps 3.
        const items: PhysicsItem[] = [
            { id: 1, x: 0, y: 0, widthUnits: 2 },
            { id: 2, x: 100, y: 0, widthUnits: 2 },
            { id: 3, x: 200, y: 0, widthUnits: 2 }
        ];
        
        // Move 1 into 2
        const candidate: PhysicsItem = { id: 1, x: 50, y: 0, widthUnits: 2 }; 
        // 1 Right edge = 150. Overlaps 2 (start 100).
        // 2 New X = 150.
        // 2 New Right Edge = 250. Overlaps 3 (start 200).
        // 3 New X = 250.
        
        const result = resolveBumps([candidate], items, CELL_SIZE);
        
        expect(result.find(i => i.id === 2)?.x).toBe(150);
        expect(result.find(i => i.id === 3)?.x).toBe(250);
    });

    it('should not bump if rows do not overlap', () => {
         const items: PhysicsItem[] = [
            { id: 1, x: 0, y: 0, widthUnits: 2 },
            { id: 2, x: 100, y: 100, widthUnits: 2 } // Different row
        ];
        
        const candidate: PhysicsItem = { id: 1, x: 80, y: 0, widthUnits: 2 }; 
        
        const result = resolveBumps([candidate], items, CELL_SIZE);
        expect(result.find(i => i.id === 2)?.x).toBe(100); // Unchanged
    });
});
