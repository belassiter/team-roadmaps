// src/utils/physics.ts

export interface PhysicsItem {
    id: string | number;
    x: number;
    y: number;
    widthUnits: number;
    [key: string]: any;
}

/**
 * Checks if a candidate item overlaps with any existing items.
 */
export const checkCollision = (candidate: PhysicsItem, existingItems: PhysicsItem[], cellSize: number): boolean => {
    const candLeft = candidate.x;
    const candRight = candidate.x + (candidate.widthUnits * cellSize);
    const candTop = candidate.y;
    const candBottom = candidate.y + cellSize;

    for (const other of existingItems) {
        if (other.id === candidate.id) continue;

        const otherLeft = other.x;
        const otherRight = other.x + (other.widthUnits * cellSize);
        const otherTop = other.y;
        const otherBottom = other.y + cellSize;

        // Simple AABB collision
        const overlapX = (candLeft < otherRight) && (candRight > otherLeft);
        const overlapY = (candTop < otherBottom) && (candBottom > otherTop);
        
        if (overlapX && overlapY) {
            return true;
        }
    }
    return false;
};

/**
 * Finds the closest valid position for an item using a spiral/neighborhood search.
 */
export const findClosestValidPosition = (
    itemId: string | number, 
    allItems: PhysicsItem[], 
    targetX: number, 
    targetY: number, 
    widthUnits: number, 
    cellSize: number, 
    gridWidth: number, 
    gridHeight: number
): { x: number; y: number } => {
    // Search radius in grid cells
    const maxRadius = 10; 

    // 0. Check the target position itself first
    const targetCandidate = { id: itemId, x: targetX, y: targetY, widthUnits: widthUnits };
    if (!checkCollision(targetCandidate, allItems, cellSize)) {
        return { x: targetX, y: targetY };
    }
    
    // We search in concentric rings around the target cell
    for (let r = 1; r <= maxRadius; r++) {
        // Generate candidates at distance r (box around center)
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                // We only want the outer ring (radius r)
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                
                const testX = targetX + (dx * cellSize);
                const testY = targetY + (dy * cellSize);
                
                // Check boundaries
                if (testX < 0 || testY < 0) continue;
                if (testX + (widthUnits * cellSize) > gridWidth) continue;
                if (testY + cellSize > gridHeight) continue;
                
                const candidate = { id: itemId, x: testX, y: testY, widthUnits: widthUnits };
                
                if (!checkCollision(candidate, allItems, cellSize)) {
                    return { x: testX, y: testY };
                }
            }
        }
    }
    
    // If completely stuck, return original position (fallback)
    const originalItem = allItems.find(i => i.id === itemId);
    if (originalItem) {
        return { x: originalItem.x, y: originalItem.y };
    }
    return { x: 0, y: 0 }; // Fallback for new items
};
