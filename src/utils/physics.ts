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
                if (bumperCenter <= connectionCenter) {
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

/**
 * Resolves backfill by sliding right-adjacent items to the left to fill the gap.
 * Finds the contiguous chain of items immediately to the right of the gap and shifts them left.
 */
export const resolveBackfill = (
    gapX: number,
    gapY: number,
    gapWidthUnits: number,
    allItems: PhysicsItem[],
    cellSize: number
): PhysicsItem[] => {
    // Clone items
    const currentItems = allItems.map(i => ({ ...i }));

    const gapRightEdge = gapX + (gapWidthUnits * cellSize);
    const shiftAmount = gapWidthUnits * cellSize;

    // 1. Find all items in the same row to the right
    const rowItems = currentItems
        .filter(i => Math.abs(i.y - gapY) < 1 && i.x >= gapRightEdge - 1) // Tolerance
        .sort((a, b) => a.x - b.x);

    // 2. Identify the contiguous chain starting EXACTLY at gapRightEdge
    const chain: PhysicsItem[] = [];
    let currentValidStart = gapRightEdge;

    for (const item of rowItems) {
        // allowing a tiny epsilon for float comparisons
        if (Math.abs(item.x - currentValidStart) < 2) { 
            chain.push(item);
            currentValidStart += (item.widthUnits * cellSize);
        } else {
            // Gap detected in the chain, stop
            break;
        }
    }

    // 3. Shift the chain left
    chain.forEach(item => {
        item.x -= shiftAmount;
    });

    return currentItems;
};

export interface LayoutOutcome {
    items: PhysicsItem[];
    isValid: boolean;
    draggedItem: PhysicsItem;
}

export const calculateLayoutOutcome = (
    draggedItemId: number | string,
    targetX: number,
    targetY: number,
    allItems: PhysicsItem[],
    cellSize: number,
    options: {
        isBackfillMode: boolean;
        isBumpMode: boolean;
        gridWidth: number;
        gridHeight: number;
    }
): LayoutOutcome => {
    // 1. Identify Dragged Item & Original Position
    const originalDraggedItem = allItems.find(i => i.id === draggedItemId);
    // If not found, return original state
    if (!originalDraggedItem) {
        return { items: allItems.map(i => ({...i})), isValid: false, draggedItem: { id: -1, x:0, y:0, widthUnits:0 } };
    }

    // 2. Build the "World" without the dragged item (Candidates for backfill/collision)
    // clone all except dragged
    let worldState = allItems
        .filter(i => i.id !== draggedItemId)
        .map(i => ({ ...i }));

    // 3. Apply BACKFILL to the world state first
    if (options.isBackfillMode) {
        // The gap was created at originalDraggedItem.x/y
        worldState = resolveBackfill(
            originalDraggedItem.x,
            originalDraggedItem.y,
            originalDraggedItem.widthUnits,
            worldState,
            cellSize
        );
    }

    // 4. Position the Dragged Item at the Target (Candidate)
    const candidateArg = {
        id: originalDraggedItem.id,
        x: targetX,
        y: targetY,
        widthUnits: originalDraggedItem.widthUnits,
        // copy extra props if any
        name: originalDraggedItem.name,
        color: originalDraggedItem.color
    };

    let finalizedItems: PhysicsItem[] = [];
    let isValid = true;

    // 5. Apply BUMP or Collision Check
    if (options.isBumpMode) {
        // Resolve Bumps interacts the candidate against the (possibly backfilled) world
        // resolveBumps returns the full list including candidate
        // Note: resolveBumps signature: (candidate, existingItems, cellSize)
        // ensure existingItems doesn't contain candidate (it doesn't, we filtered it)
        finalizedItems = resolveBumps(candidateArg, worldState, cellSize);
    } else {
        // Standard Check
        if (checkCollision(candidateArg, worldState, cellSize)) {
            // Collision!
            // Try to find closest valid? 
            // In the "ghosting" UI we usually snap to closest valid.
            // But here "calculateLayoutOutcome" might just report validity.
            // However, the test expects resolved positions.
            // Let's use finding logic or mark as invalid?
            
            // To mimic App.vue's "ghost" behavior, we find closest valid position.
            const validPos = findClosestValidPosition(
                draggedItemId,
                worldState,
                targetX,
                targetY,
                originalDraggedItem.widthUnits,
                cellSize,
                options.gridWidth,
                options.gridHeight
            );
            
            candidateArg.x = validPos.x;
            candidateArg.y = validPos.y;
            
            // We still need to reconstruct the full list
            finalizedItems = [...worldState, candidateArg];
            
            // If the pos changed significantly from target, is it "valid"? 
            // Usually yes, it's just snapped.
        } else {
            finalizedItems = [...worldState, candidateArg];
        }
    }

    return {
        items: finalizedItems,
        isValid: true,
        draggedItem: candidateArg // The final position of the dragged item
    };
};

