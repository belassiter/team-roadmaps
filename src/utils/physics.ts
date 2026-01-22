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
 * Resolves bumps by propagating collisions for multiple candidates.
 */
export const resolveBumps = (
    candidates: PhysicsItem[], 
    allItems: PhysicsItem[],
    cellSize: number
): PhysicsItem[] => {
    // 1. Create a working set
    const currentItems = new Map<number | string, PhysicsItem>();
    
    // Load existing items, excluding candidates (to avoid duplication if they are in allItems)
    const candidateIds = new Set(candidates.map(c => c.id));
    allItems.forEach(item => {
        if (candidateIds.has(item.id)) return; 
        currentItems.set(item.id, { ...item });
    });

    // Add candidates (Source of Truth)
    candidates.forEach(c => {
        currentItems.set(c.id, { ...c });
    });

    // 2. Queue for propagation
    const queue: PhysicsItem[] = [...candidates];
    
    let iterations = 0;
    const MAX_ITERATIONS = 1000; 

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const bumper = queue.shift()!;
        
        // Find overlaps with this bumper
        for (const [id, connection] of currentItems) {
            if (id === bumper.id) continue;
            
            const bumperRight = bumper.x + (bumper.widthUnits * cellSize);
            const bumperBottom = bumper.y + cellSize;
            
            const connRight = connection.x + (connection.widthUnits * cellSize);
            const connBottom = connection.y + cellSize;

            const overlapX = (bumper.x < connRight) && (bumperRight > connection.x);
            const overlapY = (bumper.y < connBottom) && (bumperBottom > connection.y);

            if (overlapX && overlapY) {
                // COLLISION
                const bumperCenter = bumper.x + (bumper.widthUnits * cellSize) / 2;
                const connectionCenter = connection.x + (connection.widthUnits * cellSize) / 2;

                let newX = connection.x;
                
                if (bumperCenter <= connectionCenter) {
                    newX = bumperRight;
                } else {
                    newX = bumper.x - (connection.widthUnits * cellSize);
                }

                if (newX < 0) newX = 0;

                if (newX !== connection.x) {
                    connection.x = newX;
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
    draggedItems: PhysicsItem[]; 
}

export const calculateLayoutOutcome = (
    draggedItemsArgs: { id: string | number, targetX: number, targetY: number }[],
    allItems: PhysicsItem[],
    cellSize: number,
    options: {
        isBackfillMode: boolean;
        isBumpMode: boolean;
        gridWidth: number;
        gridHeight: number;
    }
): LayoutOutcome => {
    // 1. Identify Dragged Items & Original Positions
    const outputDraggedItems: PhysicsItem[] = [];
    const draggedIds = new Set<string | number>();
    const originalPositions: { x: number, y: number, widthUnits: number }[] = [];

    draggedItemsArgs.forEach(arg => {
        const original = allItems.find(i => i.id === arg.id);
        if (original) {
            draggedIds.add(arg.id);
            originalPositions.push({ x: original.x, y: original.y, widthUnits: original.widthUnits });
            outputDraggedItems.push({
                ...original,
                x: arg.targetX,
                y: arg.targetY
            });
        }
    });

    if (outputDraggedItems.length === 0) {
        return { items: allItems.map(i => ({...i})), isValid: false, draggedItems: [] };
    }

    // 2. Build World (excluding dragged)
    let worldState = allItems
        .filter(i => !draggedIds.has(i.id))
        .map(i => ({ ...i }));

    // 3. Backfill
    if (options.isBackfillMode) {
        // Re-implementing step 1/3 to be more robust
        const activeOrigins: { x: number, y: number, widthUnits: number }[] = [];
        
        draggedItemsArgs.forEach(arg => {
             const original = allItems.find(i => i.id === arg.id);
             if (original) {
                 const originX = original.x;
                 const originY = original.y;
                 const widthPx = original.widthUnits * cellSize;
                 
                 // Check Overlap
                 const targetRight = arg.targetX + widthPx;
                 const originRight = originX + widthPx;
                 const targetBottom = arg.targetY + cellSize;
                 const originBottom = originY + cellSize;

                 const overlapX = (arg.targetX < originRight) && (targetRight > originX);
                 const overlapY = (arg.targetY < originBottom) && (targetBottom > originY);
                 
                 if (!(overlapX && overlapY)) {
                     activeOrigins.push({ x: originX, y: originY, widthUnits: original.widthUnits });
                 }
             }
        });

        const sortedOrigins = activeOrigins.sort((a, b) => b.x - a.x);
        
        sortedOrigins.forEach(origin => {
            worldState = resolveBackfill(origin.x, origin.y, origin.widthUnits, worldState, cellSize);
        });
    }

    let finalizedItems: PhysicsItem[] = [];

    // 4. Bump or Collision
    if (options.isBumpMode) {
        finalizedItems = resolveBumps(outputDraggedItems, worldState, cellSize);
    } else {
        // Standard Collision Check for Group
        let collisionDetected = false;
        for (const cand of outputDraggedItems) {
            if (checkCollision(cand, worldState, cellSize)) {
                collisionDetected = true;
                break;
            }
        }

        if (collisionDetected) {
            // Find valid position for the GROUP
            const anchor = outputDraggedItems[0];
            const anchorArg = draggedItemsArgs[0];
            
            const others = outputDraggedItems.slice(1);
            const relativeOffsets = others.map(o => ({
                id: o.id,
                dx: o.x - anchor.x,
                dy: o.y - anchor.y
            }));

            const maxRadius = 10;
            let found = false;
             
            const checkGroup = (ax: number, ay: number): boolean => {
                const testAnchor = { ...anchor, x: ax, y: ay };
                if (checkCollision(testAnchor, worldState, cellSize)) return false;
                if (ax < 0 || ay < 0 || ax + anchor.widthUnits*cellSize > options.gridWidth || ay + cellSize > options.gridHeight) return false;

                for (let i=0; i<others.length; i++) {
                    const o = others[i];
                    const off = relativeOffsets[i];
                    const ox = ax + off.dx;
                    const oy = ay + off.dy;
                    const testOther = { ...o, x: ox, y: oy };
                    if (checkCollision(testOther, worldState, cellSize)) return false;
                    if (ox < 0 || oy < 0 || ox + o.widthUnits*cellSize > options.gridWidth || oy + cellSize > options.gridHeight) return false;
                }
                return true;
            };

            if (checkGroup(anchor.x, anchor.y)) {
                found = true; 
            } else {
                for (let r = 1; r <= maxRadius; r++) {
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                             if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                             const tx = anchorArg.targetX + (dx * cellSize);
                             const ty = anchorArg.targetY + (dy * cellSize);
                             if (checkGroup(tx, ty)) {
                                 anchor.x = tx;
                                 anchor.y = ty;
                                 others.forEach((o, idx) => {
                                     o.x = tx + relativeOffsets[idx].dx;
                                     o.y = ty + relativeOffsets[idx].dy;
                                 });
                                 found = true;
                                 break;
                             }
                        }
                        if (found) break;
                    }
                    if (found) break;
                }
            }
            
            finalizedItems = [...worldState, ...outputDraggedItems];
        } else {
            finalizedItems = [...worldState, ...outputDraggedItems];
        }
    }

    return {
        items: finalizedItems,
        isValid: true,
        draggedItems: outputDraggedItems
    };
};

