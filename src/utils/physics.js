// src/utils/physics.js

/**
 * Checks if a candidate item overlaps with any existing items.
 * @param {Object} candidate - { id, x, y, widthUnits }
 * @param {Array} existingItems - Array of items to check against
 * @param {Number} cellSize - Pixel size of one grid cell
 * @returns {Boolean} True if collision detected
 */
export const checkCollision = (candidate, existingItems, cellSize) => {
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
 * @param {Number} itemId - ID of the item being moved
 * @param {Array} allItems - All items on the board
 * @param {Number} targetX - Desired X position (px)
 * @param {Number} targetY - Desired Y position (px)
 * @param {Number} widthUnits - Width of the item in grid units
 * @param {Number} cellSize - Pixel size of grid cells
 * @param {Number} gridWidth - Total width of grid (px)
 * @param {Number} gridHeight - Total height of grid (px)
 * @returns {Object} { x, y } of the valid position found (or original/fallback)
 */
export const findClosestValidPosition = (
    itemId, 
    allItems, 
    targetX, 
    targetY, 
    widthUnits, 
    cellSize, 
    gridWidth, 
    gridHeight
) => {
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
    // Note: The caller might need to handle the case where "original position" isn't passed in here.
    // Ideally we return the targetX/Y if force is allowed, or null. 
    // For now returning target to prevent breaking, but in App.vue we fallback to original item state.
    const originalItem = allItems.find(i => i.id === itemId);
    if (originalItem) {
        return { x: originalItem.x, y: originalItem.y };
    }
    return { x: 0, y: 0 }; // Fallback for new items
};
