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

/**
 * Resolves bumps by propagating collisions.
 * Returns a list of all items (cloned) with their new resolved positions.
 * The candidate item is included in the return list at its fixed position.
 */
export const resolveBumps = (
    candidate: PhysicsItem,
    allItems: PhysicsItem[],
    cellSize: number
): PhysicsItem[] => {
    // 1. Create a working set of items (clones)
    // Map ID -> Item
    const currentItems = new Map<number | string, PhysicsItem>();
    
    allItems.forEach(item => {
        if (item.id === candidate.id) return; // Skip the candidate in the initial load, we add it explicitly
        // Clone to avoid mutating original
        currentItems.set(item.id, { ...item });
    });

    // Add candidate (Source of Truth)
    currentItems.set(candidate.id, { ...candidate });

    // 2. Queue for propagation
    // We only process items that have moved or are the source
    const queue: PhysicsItem[] = [candidate];
    
    let iterations = 0;
    const MAX_ITERATIONS = 500; // Safety break

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const bumper = queue.shift()!;
        
        // Find overlaps with this bumper
        for (const [id, connection] of currentItems) {
            if (id === bumper.id) continue;
            
            // Overlap Check (using checkCollision logic inline or tool)
            // checkCollision expects a list, let's just do single AABB check here for speed
            const bumperRight = bumper.x + (bumper.widthUnits * cellSize);
            const bumperBottom = bumper.y + cellSize;
            
            const connRight = connection.x + (connection.widthUnits * cellSize);
            const connBottom = connection.y + cellSize;

            const overlapX = (bumper.x < connRight) && (bumperRight > connection.x);
            const overlapY = (bumper.y < connBottom) && (bumperBottom > connection.y);

            if (overlapX && overlapY) {
                // COLLISION DETECTED
                
                // Which way to push?
                const bumperCenter = bumper.x + (bumper.widthUnits * cellSize) / 2;
                const connectionCenter = connection.x + (connection.widthUnits * cellSize) / 2;

                let newX = connection.x;
                
                // If bumper is to the left, push connection RIGHT
                if (bumperCenter < connectionCenter) {
                    newX = bumperRight;
                } else {
                    // Push LEFT
                    newX = bumper.x - (connection.widthUnits * cellSize);
                }

                // Snap to cell size (optional, but good for alignment)
                // Assuming everything is already snapped, newX should be snapped if widths are integer units
                // But let's enforce it to be safe? 
                // No, bumper.x might be drag-offset? No, candidate passed in is usually snapped.
                
                // Clamp to 0
                if (newX < 0) newX = 0;

                // Did it move?
                if (newX !== connection.x) {
                    connection.x = newX;
                    // It moved, so it is now a bumper
                    queue.push(connection);
                }
            }
        }
    }

    return Array.from(currentItems.values());
};
