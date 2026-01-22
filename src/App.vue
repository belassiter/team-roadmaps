<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, type Directive } from 'vue';
import { formatDate, parseLocalYMD } from './utils/dates';
import { checkCollision, resolveBackfill, calculateLayoutOutcome, type PhysicsItem } from './utils/physics';
import TaskListModal from './components/TaskListModal.vue';
import GridSettingsModal from './components/GridSettingsModal.vue';
import TaskEditModal from './components/TaskEditModal.vue';

// --- Interfaces ---
interface TaskItem extends PhysicsItem {
    name: string;
    color?: string;
    [key: string]: any;
}

interface GridConfig {
    cols: number;
    rows: number;
    rowDefinitions: Record<string, string>; // "0": "Row 1"
}

interface AxisConfig {
    mode: 'number' | 'day' | 'week' | string;
    startDate: string;
    weekdaysOnly?: boolean;
    [key: string]: any;
}

// --- Configuration ---
const CELL_SIZE = 50; // Fixed cell size

const gridConfig = reactive<GridConfig>({
    cols: 20,
    rows: 5,
    rowDefinitions: {}
});

// Computed grid dimensions
const gridWidth = computed(() => gridConfig.cols * CELL_SIZE);
const gridHeight = computed(() => visibleRowIndices.value.length * CELL_SIZE);

const rowFilter = ref('');

const visibleRowIndices = computed(() => {
    if (!rowFilter.value.trim()) {
        return Array.from({ length: gridConfig.rows }, (_, i) => i);
    }
    const query = rowFilter.value.toLowerCase();
    const result: number[] = [];
    for (let i = 0; i < gridConfig.rows; i++) {
        const name = getRowName(i).toLowerCase();
        if (name.includes(query)) {
            result.push(i);
        }
    }
    return result;
});

const getVisualY = (realY: number) => {
    const row = Math.round(realY / CELL_SIZE);
    const visualIndex = visibleRowIndices.value.indexOf(row);
    if (visualIndex === -1) return null; 
    return visualIndex * CELL_SIZE;
};

const getRealYFromVisualY = (visualY: number) => {
    const vRow = Math.round(visualY / CELL_SIZE);
    if (visibleRowIndices.value.length === 0) return 0;
    const clampedVRow = Math.max(0, Math.min(vRow, visibleRowIndices.value.length - 1));
    const realRow = visibleRowIndices.value[clampedVRow];
    return realRow * CELL_SIZE;
};

// --- Axis Settings ---
const axisConfig = reactive<AxisConfig>({
    mode: 'number', // number, day, week
    startDate: new Date().toISOString().substring(0, 10), // string YYYY-MM-DD
    weekdaysOnly: false
});

const axisLabels = computed(() => {
    const labels: (string | number)[] = [];
    let currentDate = parseLocalYMD(axisConfig.startDate);
    
    if (axisConfig.mode === 'week') {
        const day = currentDate.getDay();
        const diff = day === 0 ? 6 : day - 1; 
        currentDate.setDate(currentDate.getDate() - diff);
    }

    for (let i = 0; i < gridConfig.cols; i++) {
        if (axisConfig.mode === 'number') {
            labels.push(i + 1);
        } else if (axisConfig.mode === 'day') {
            if (axisConfig.weekdaysOnly) {
                while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            labels.push(formatDate(new Date(currentDate), 'day'));
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (axisConfig.mode === 'week') {
            labels.push(formatDate(new Date(currentDate), 'week'));
            currentDate.setDate(currentDate.getDate() + 7);
        }
    }
    return labels;
});

const getRowName = (rowIndex: number): string => {
    if (gridConfig.rowDefinitions[rowIndex]) {
        return gridConfig.rowDefinitions[rowIndex];
    }
    return String(rowIndex + 1);
};

// --- Row Editing ---
const editingRowIndex = ref<number | null>(null);
const tempRowName = ref('');

const startEditRow = (index: number) => {
    editingRowIndex.value = index;
    tempRowName.value = getRowName(index);
};

const saveEditRow = () => {
    if (editingRowIndex.value !== null) {
        if (tempRowName.value.trim() === '') {
            delete gridConfig.rowDefinitions[editingRowIndex.value];
        } else {
            gridConfig.rowDefinitions[editingRowIndex.value] = tempRowName.value.trim();
        }
        editingRowIndex.value = null;
    }
};

const cancelEditRow = () => {
    editingRowIndex.value = null;
};

// --- Modals State ---
const isGridSettingsOpen = ref(false);
const isTaskEditOpen = computed(() => selectedItemIds.value.size === 1);

const updateGridSettings = (newGrid: {cols: number, rows: number}, newAxis: AxisConfig) => {
    // Validate
    const newW = newGrid.cols * CELL_SIZE;
    const newH = newGrid.rows * CELL_SIZE;

    // Validate against existing items
    for (const item of items) {
        const itemRight = item.x + (item.widthUnits * CELL_SIZE);
        const itemBottom = item.y + CELL_SIZE;
 
        if (itemRight > newW) {
            alert(`Error: Item "${item.name}" would be cut off horizontally.`);
            return;
        }
        if (itemBottom > newH) {
            alert(`Error: Item "${item.name}" would be cut off vertically.`);
            return;
        }
    }

    gridConfig.cols = newGrid.cols;
    gridConfig.rows = newGrid.rows;
    Object.assign(axisConfig, newAxis);
    isGridSettingsOpen.value = false;
};

// --- State ---
const boardContainer = ref<HTMLElement | null>(null);
const axisHeader = ref<HTMLElement | null>(null);
const rowHeader = ref<HTMLElement | null>(null);

const handleScroll = () => {
    if (boardContainer.value) {
        if (axisHeader.value) {
            axisHeader.value.scrollLeft = boardContainer.value.scrollLeft;
        }
        if (rowHeader.value) {
            rowHeader.value.scrollTop = boardContainer.value.scrollTop;
        }
    }
};

const isDragging = ref(false);
const isBumpMode = ref(false);
const isBackfillMode = ref(false);
const bumpGhosts = ref<PhysicsItem[]>([]); 
const backfillGhosts = ref<PhysicsItem[]>([]); 
const draggedGhosts = ref<PhysicsItem[]>([]);

const startX = ref(0);
const startY = ref(0);

const draggingItemIndex = ref<number | null>(null);
const selectedItemIds = ref<Set<string | number>>(new Set([1]));

const items = reactive<TaskItem[]>([
    {
        id: 1,
        x: 0,
        y: 0,
        widthUnits: 2,
        name: 'Task 1',
        color: '#3b82f6'
    }
]);

const dragOffset = ref({ x: 0, y: 0 });

// --- Computed ---

const selectedItem = computed(() => {
    if (selectedItemIds.value.size === 1) {
        const id = Array.from(selectedItemIds.value)[0];
        return items.find(item => item.id === id);
    }
    return null;
});

const ghost = reactive({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    color: 'transparent',
    visible: false
});

const bumpedItemIds = computed(() => {
    const ids = new Set<string | number>();

    // Bump Mode logic
    if (isBumpMode.value && bumpGhosts.value.length > 0) {
        bumpGhosts.value.forEach(g => {
            // New logic: Only hide the item if it has MOVED from its original position
            // AND it's not the currently dragged item (dragged item is handled by main render loop)
            
            if (draggingItemIndex.value !== null && items[draggingItemIndex.value].id === g.id) {
                return;
            }

            const original = items.find(i => i.id === g.id);
            if (original) {
                if (original.x !== g.x || original.y !== g.y) {
                    ids.add(g.id);
                }
            }
        });
    }

    // Backfill Mode logic
    if (isBackfillMode.value && backfillGhosts.value.length > 0) {
        backfillGhosts.value.forEach(g => {
            // For backfill, we definitely hide the item at its old position so we can show the ghost at the new one
            // (Unless it's the dragged item itself, which is handled separately)
            if (draggingItemIndex.value !== null && items[draggingItemIndex.value].id === g.id) {
                return;
            }
            ids.add(g.id);
        });
    }

    return ids;
});

// --- History / Undo ---
const history = ref<TaskItem[][]>([]);

const saveHistory = () => {
    history.value.push(JSON.parse(JSON.stringify(items)));
    if (history.value.length > 50) history.value.shift();
};

const undo = () => {
    if (history.value.length === 0) return;
    const previousState = history.value.pop();
    if (previousState) {
        items.splice(0, items.length, ...previousState);
        selectedItemIds.value.clear();
    }
};

// --- Methods ---

const getItemStyle = (item: TaskItem, index: number) => {
    const visualYStart = getVisualY(item.y);
    // If the item is in a hidden row, hide it (unless it's being dragged, maybe? 
    // But if we start dragging, it must be visible. If we drag it and filter changes... unlikely edge case).
    if (visualYStart === null) {
        return { display: 'none' };
    }

    const isBeingDragged = draggingItemIndex.value === index;
    
    let x = item.x;
    let y = visualYStart;
    
    if (isBeingDragged) {
        x += dragOffset.value.x;
        y += dragOffset.value.y;
    }

    return {
        transform: `translate(${x}px, ${y}px)`,
        width: `${item.widthUnits * CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        backgroundColor: item.color,
        borderColor: 'rgba(0,0,0,0.2)' 
    };
};

const addItem = () => {
    saveHistory();
    const newId = items.length > 0 ? Math.max(...items.map(i => Number(i.id))) + 1 : 1;
    
    let newX = 0;
    let newY = 0;
    let found = false;
    
    for (let r = 0; r < gridConfig.rows; r++) {
        for (let c = 0; c < gridConfig.cols; c++) {
            const testX = c * CELL_SIZE;
            const testY = r * CELL_SIZE;
            
            const dummyItem = { id: newId, x: testX, y: testY, widthUnits: 2 };
            // Pass CELL_SIZE
            if (!checkCollision(dummyItem, items, CELL_SIZE)) { 
                newX = testX;
                newY = testY;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    const newItem: TaskItem = {
        id: newId,
        x: newX,
        y: newY,
        widthUnits: 2,
        name: `Task ${newId}`,
        color: '#10b981'
    };
    
    items.push(newItem);
    selectedItemIds.value.clear();
    selectedItemIds.value.add(newId);
};

const deleteItem = () => {
    if (selectedItemIds.value.size === 0) return;

    saveHistory();

    const idsToDelete = Array.from(selectedItemIds.value);
    
    // Sort items by X descending to process right-most first for backfill safety
    const itemsToDelete = items
        .filter(i => idsToDelete.includes(i.id))
        .sort((a, b) => b.x - a.x);

    // Remove them
    for (const item of itemsToDelete) {
        const index = items.indexOf(item);
        if (index !== -1) items.splice(index, 1);
    }

    selectedItemIds.value.clear();

    if (isBackfillMode.value) {
        // Iterate originals to trigger backfill
        itemsToDelete.forEach(original => {
            const backfilled = resolveBackfill(
                original.x,
                original.y,
                original.widthUnits,
                items, 
                CELL_SIZE
            );
            
            // Sync results
            backfilled.forEach(b => {
                const realItem = items.find(i => i.id === b.id);
                if (realItem) {
                    realItem.x = b.x;
                    realItem.y = b.y;
                }
            });
        });
    }
};

const startDrag = (event: MouseEvent, index: number) => {
    if (draggingItemIndex.value !== null) return; 

    const item = items[index];
    const isSelected = selectedItemIds.value.has(item.id);

    if (event.ctrlKey || event.metaKey) {
        if (isSelected) {
            selectedItemIds.value.delete(item.id);
            return;
        } else {
            selectedItemIds.value.add(item.id);
        }
    } else {
        if (!isSelected) {
            selectedItemIds.value.clear();
            selectedItemIds.value.add(item.id);
        }
    }

    // Only drag if selected
    if (!selectedItemIds.value.has(item.id)) return;

    draggingItemIndex.value = index;
    isDragging.value = true;
    startX.value = event.clientX;
    startY.value = event.clientY;

    updateGhost();

    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};

const onDrag = (event: MouseEvent) => {
    if (!isDragging.value) return;

    const dx = event.clientX - startX.value;
    const dy = event.clientY - startY.value;

    dragOffset.value = { x: dx, y: dy };
    updateGhost(); 
};

const toggleBumpMode = () => {
    isBumpMode.value = !isBumpMode.value;
    bumpGhosts.value = [];
};

const updateGhost = () => {
    // We will use bumpGhosts/backfillGhosts as the "Simulated World Items"
    draggedGhosts.value = []; 

    const index = draggingItemIndex.value;
    if (index === null) return;
    
    // Anchor Item (The one we clicked)
    const anchorItem = items[index];
    
    // All Selected Items (including anchor)
    const draggedIds = Array.from(selectedItemIds.value);
    
    // Prepare arguments for layout calculation
    const draggedItemsArgs: { id: string | number, targetX: number, targetY: number }[] = [];
    
    // Calculate Anchor New Position
    let anchorRawX = anchorItem.x + dragOffset.value.x;
    // let anchorRawY = anchorItem.y + dragOffset.value.y; // unused in filtered logic
    let anchorSnappedX = Math.round(anchorRawX / CELL_SIZE) * CELL_SIZE;
    
    // Y Logic: Map Visual Drag -> Visual Snap -> Real Snap
    let anchorSnappedY = anchorItem.y;
    const anchorVisualStart = getVisualY(anchorItem.y);

    if (anchorVisualStart !== null) {
        const anchorVisualY = anchorVisualStart + dragOffset.value.y;
        // Snap visually
        const anchorVisualSnapped = Math.round(anchorVisualY / CELL_SIZE) * CELL_SIZE;
        // Convert to Real
        anchorSnappedY = getRealYFromVisualY(anchorVisualSnapped);
    }

    anchorSnappedX = Math.max(0, anchorSnappedX);
    // anchorSnappedY is handled by getRealYFromVisualY which clamps to valid rows
    
    // Constrain Anchor (assuming group follows)
    // Note: We might want to constrain the whole group, but constraining anchor is a good start.
    // If not Bump Mode, constrain to grid
    if (!isBumpMode.value) {
        // We should check the RIGHTMOST edge of the group relative to the anchor
        // For now, simple anchor constraint + grid expansion checks
        const itemPxWidth = anchorItem.widthUnits * CELL_SIZE;
        anchorSnappedX = Math.min(anchorSnappedX, gridWidth.value - itemPxWidth);
    }
    // anchorSnappedY = Math.min(anchorSnappedY, gridHeight.value - CELL_SIZE); // Removed, handled by clamp mechanism
    
    // Delta for the group
    const dx = anchorSnappedX - anchorItem.x;
    const dy = anchorSnappedY - anchorItem.y;
    
    // Build args for all selected items
    draggedIds.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
            draggedItemsArgs.push({
                id: item.id,
                targetX: item.x + dx,
                targetY: item.y + dy
            });
        }
    });

    // --- Unified Layout Calculation ---
    const outcome = calculateLayoutOutcome(
        draggedItemsArgs,
        items,
        CELL_SIZE,
        {
            isBackfillMode: isBackfillMode.value,
            isBumpMode: isBumpMode.value,
            gridWidth: gridWidth.value,
            gridHeight: gridHeight.value,
        }
    );

    // 1. Update Dragged Ghosts
    draggedGhosts.value = outcome.draggedItems;

    // Update the single 'ghost' prop just in case something relies on it, 
    // or we can deprecate it. Let's keep it sync with anchor for now to avoid breaking template yet.
    const anchorGhost = outcome.draggedItems.find(i => i.id === anchorItem.id);
    if (anchorGhost) {
        ghost.x = anchorGhost.x;
        ghost.y = anchorGhost.y;
        ghost.width = anchorGhost.widthUnits * CELL_SIZE;
        ghost.height = CELL_SIZE;
        ghost.color = anchorItem.color || '#ccc';
        ghost.visible = true;
    }

    // 2. Update Environmental Ghosts
    bumpGhosts.value = outcome.items;
    backfillGhosts.value = outcome.items;

    // Check grid expansion
    let maxRight = 0;
    
    [...outcome.items, ...outcome.draggedItems].forEach(p => {
        const r = p.x + (p.widthUnits * CELL_SIZE);
        if (r > maxRight) maxRight = r;
    });
    
    if (maxRight > gridWidth.value) {
        gridConfig.cols = Math.ceil(maxRight / CELL_SIZE);
    }
};

const stopDrag = () => {
    if (!isDragging.value) return;
    
    const index = draggingItemIndex.value;
    if (index !== null) {
        // Re-run logic to be safe (same as updateGhost)
        const anchorItem = items[index];
        const draggedIds = Array.from(selectedItemIds.value);
         
        // Re-calculating snap with constraints
        let anchorSnappedX = Math.round((anchorItem.x + dragOffset.value.x) / CELL_SIZE) * CELL_SIZE;
        anchorSnappedX = Math.max(0, anchorSnappedX);

        let anchorSnappedY = anchorItem.y;
        const anchorVisualStart = getVisualY(anchorItem.y);
        if (anchorVisualStart !== null) {
            const anchorVisualY = anchorVisualStart + dragOffset.value.y;
            const anchorVisualSnapped = Math.round(anchorVisualY / CELL_SIZE) * CELL_SIZE;
            anchorSnappedY = getRealYFromVisualY(anchorVisualSnapped);
        }

        if (!isBumpMode.value) {
            const itemPxWidth = anchorItem.widthUnits * CELL_SIZE;
            anchorSnappedX = Math.min(anchorSnappedX, gridWidth.value - itemPxWidth);
        }
        // anchorSnappedY = Math.min(anchorSnappedY, gridHeight.value - CELL_SIZE); // Removed
         
        const finalDx = anchorSnappedX - anchorItem.x;
        const finalDy = anchorSnappedY - anchorItem.y;

        const draggedItemsArgs = draggedIds.map(id => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return {
                id: item.id,
                targetX: item.x + finalDx,
                targetY: item.y + finalDy
            };
        }).filter(Boolean) as { id: string | number, targetX: number, targetY: number }[];

        const outcome = calculateLayoutOutcome(
            draggedItemsArgs,
            items,
            CELL_SIZE,
            {
                isBackfillMode: isBackfillMode.value,
                isBumpMode: isBumpMode.value,
                gridWidth: gridWidth.value,
                gridHeight: gridHeight.value,
            }
        );

        if (outcome.isValid) {
            let changed = false;

            // Check dragged items
            outcome.draggedItems.forEach(d => {
                const original = items.find(i => i.id === d.id);
                if (original && (original.x !== d.x || original.y !== d.y)) {
                    changed = true;
                }
            });
            
            // Check bumped/backfilled items
            outcome.items.forEach(d => {
                const original = items.find(i => i.id === d.id);
                if (original && (original.x !== d.x || original.y !== d.y)) {
                    changed = true;
                }
            });

            if (changed) {
                saveHistory();

                outcome.draggedItems.forEach(d => {
                    const original = items.find(i => i.id === d.id);
                    if (original) {
                        original.x = d.x;
                        original.y = d.y;
                    }
                });

                outcome.items.forEach(d => {
                    const original = items.find(i => i.id === d.id);
                    if (original) {
                        original.x = d.x;
                        original.y = d.y;
                    }
                });
            }
        }
    }

    isDragging.value = false;
    draggingItemIndex.value = null;
    dragOffset.value = { x: 0, y: 0 };
    ghost.visible = false;
    draggedGhosts.value = [];
    bumpGhosts.value = []; 
    backfillGhosts.value = [];

    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
};

// --- Persistence (Save/Load) ---
const fileInput = ref<HTMLInputElement | null>(null);

const saveProject = () => {
    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        gridConfig: { ...gridConfig },
        axisConfig: { ...axisConfig },
        items: items
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = `team-roadmap-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const triggerLoad = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (e.target?.result) {
                const data = JSON.parse(e.target.result as string);
                
                if (data.items && Array.isArray(data.items)) {
                    items.length = 0; 
                    items.push(...data.items);
                }
                
                if (data.gridConfig) {
                    gridConfig.cols = data.gridConfig.cols;
                    gridConfig.rows = data.gridConfig.rows;
                    gridConfig.rowDefinitions = data.gridConfig.rowDefinitions || {};
                }

                if (data.axisConfig) {
                    Object.assign(axisConfig, data.axisConfig);
                }
                
                selectedItemIds.value.clear();
                saveHistory(); 
            }

        } catch (err) {
            console.error("Failed to load project:", err);
            alert("Error loading file. It may be corrupted or invalid JSON.");
        }
    };
    reader.readAsText(file);
    target.value = ''; 
};

// --- Lifecycle ---
const handleKeydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemIds.value.size > 0) {
        // Avoid deleting if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        deleteItem();
    }
};

const isListModalOpen = ref(false);

const vFocus: Directive = {
    mounted: (el) => el.focus()
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    console.log('Grid Config:', gridConfig);
    console.log('Grid Sizes:', gridWidth.value, gridHeight.value);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});

</script>

<template>
    <TaskListModal
        :is-open="isListModalOpen"
        :items="items"
        :axis-config="axisConfig"
        :cell-size="CELL_SIZE"
        :grid-config="gridConfig"
        @close="isListModalOpen = false"
    />

    <GridSettingsModal
        :is-open="isGridSettingsOpen"
        :grid-config="gridConfig"
        :axis-config="axisConfig"
        @close="isGridSettingsOpen = false"
        @save="updateGridSettings"
    />

    <TaskEditModal
        :is-open="isTaskEditOpen"
        :item="selectedItem"
        @close="selectedItemIds.clear()"
        @update="saveHistory"
    />

    <header>
        <div class="header-row">
            <div style="display: flex; align-items: center; gap: 10px;">
                <button
                    class="btn-icon"
                    title="Grid Settings"
                    @click="isGridSettingsOpen = true"
                >
                    ⚙️
                </button>
                <h1>Team Roadmaps</h1>
            </div>

            <div class="header-controls">
                <button
                    class="btn-secondary"
                    style="font-size: 1.2rem; padding: 0 10px;"
                    title="List View"
                    @click="isListModalOpen = true"
                >
                    📜
                </button>
                <button
                    class="btn-primary"
                    @click="saveProject"
                >
                    Save
                </button>
                <button
                    class="btn-secondary"
                    @click="triggerLoad"
                >
                    Load
                </button>
                <!-- Hidden file input for loading -->
                <input
                    ref="fileInput"
                    type="file"
                    style="display: none"
                    accept=".json"
                    @change="handleFileUpload"
                >
            </div>
        </div>
        
        <div class="toolbar-row">
            <div class="instructions">
                Drag the rectangle. Click to edit.
            </div>
            <div class="toolbar-actions">
                <button
                    class="btn-secondary"
                    style="font-weight: bold;"
                    :class="{ active: isBumpMode }"
                    :style="{ color: isBumpMode ? 'green' : 'red' }"
                    @click="toggleBumpMode"
                >
                    Bump: {{ isBumpMode ? 'ON' : 'OFF' }}
                </button>
                <button
                    class="btn-secondary"
                    style="font-weight: bold;"
                    :class="{ active: isBackfillMode }"
                    :style="{ color: isBackfillMode ? 'blue' : 'gray' }"
                    @click="isBackfillMode = !isBackfillMode"
                >
                    Backfill: {{ isBackfillMode ? 'ON' : 'OFF' }}
                </button>
                
                <div class="separator" />
                
                <button
                    v-if="selectedItemIds.size > 0"
                    class="btn-danger"
                    @click="deleteItem"
                >
                    Delete Selected
                </button>
                <button
                    class="btn-primary"
                    @click="addItem"
                >
                    + Add Work Item
                </button>
            </div>
        </div>
    </header>

    <div class="app-layout">
        <!-- The Board Area (Scrollable Wrapper) -->
        <div class="main-content">
            <!-- Top Controls (Axis Header) -->
            <div class="grid-header-row">
                <!-- Empty Corner for Row Labels -->
                <div class="corner-cell">
                    <input 
                        v-model="rowFilter" 
                        placeholder="Filter..." 
                        style="width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; padding: 4px;"
                    >
                </div>

                <!-- Sticky Axis Header -->
                <div
                    ref="axisHeader"
                    class="axis-header"
                >
                    <div 
                        class="axis-content"
                        :style="{ width: gridWidth + 'px' }"
                    >
                        <div
                            v-for="(label, index) in axisLabels"
                            :key="index"
                            class="axis-cell"
                            :title="String(label)"
                        >
                            {{ label }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid-body-row">
                <!-- Row Headers -->
                <div
                    ref="rowHeader"
                    class="row-header-container"
                >
                    <div 
                        class="row-header-content"
                        :style="{ height: gridHeight + 'px' }"
                    >
                        <div
                            v-for="realRowIndex in visibleRowIndices"
                            :key="realRowIndex"
                            class="row-label-cell"
                            :class="{ 'editing': editingRowIndex === realRowIndex }"
                            :title="getRowName(realRowIndex)"
                            @click="startEditRow(realRowIndex)"
                        >
                            <input
                                v-if="editingRowIndex === realRowIndex"
                                v-model="tempRowName"
                                v-focus
                                class="row-edit-input"
                                @blur="saveEditRow"
                                @keydown.enter="saveEditRow"
                                @keydown.esc="cancelEditRow"
                            >
                            <span v-else>
                                {{ getRowName(realRowIndex) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Board -->
                <div
                    ref="boardContainer"
                    class="board-container"
                    @scroll="handleScroll"
                    @click.self="selectedItemIds.clear()"
                >
                    <div
                        class="board-content"
                        :style="{ 
                            width: gridWidth + 'px', 
                            height: gridHeight + 'px',
                        }"
                    >
                        <!-- The Grid Background -->
                        <!-- Clicking background deselects item -->
                        <div
                            class="grid-background"
                            @click="selectedItemIds.clear()"
                        />

                        <!-- The Ghost Items (Multi-Drag) -->
                        <div 
                            v-if="isDragging && draggedGhosts.length > 0"
                        >
                            <template
                                v-for="g in draggedGhosts"
                                :key="'drag-ghost-' + g.id"
                            >
                                <div 
                                    v-if="getVisualY(g.y) !== null"
                                    class="ghost-item"
                                    :style="{
                                        transform: `translate(${g.x}px, ${getVisualY(g.y)}px)`,
                                        width: `${g.widthUnits * CELL_SIZE}px`,
                                        height: `${CELL_SIZE}px`,
                                        borderColor: g.color || '#ccc',
                                        backgroundColor: g.color || '#ccc'
                                    }"
                                />
                            </template>
                        </div>

                        <!-- The Bump Mode Ghosts -->
                        <div 
                            v-if="isBumpMode && bumpGhosts.length > 0"
                        >
                            <template
                                v-for="g in bumpGhosts"
                                :key="'bump-ghost-' + g.id"
                            >
                                <div
                                    v-if="bumpedItemIds.has(g.id) && getVisualY(g.y) !== null"
                                    class="ghost-item bump-ghost-hatched"
                                    style="z-index: 5; border-style: solid; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font-size: 0.85rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);"
                                    :style="{
                                        transform: `translate(${g.x}px, ${getVisualY(g.y)}px)`,
                                        width: `${g.widthUnits * CELL_SIZE}px`,
                                        height: `${CELL_SIZE}px`,
                                        backgroundColor: g.color || '#ccc',
                                        borderColor: 'rgba(0,0,0,0.5)'
                                    }"
                                >
                                    {{ items.find(i => i.id === g.id)?.name }}
                                </div>
                            </template>
                        </div>

                        <!-- The Backfill Mode Ghosts -->
                        <div 
                            v-if="isBackfillMode && backfillGhosts.length > 0"
                        >
                            <template
                                v-for="g in backfillGhosts"
                                :key="'backfill-ghost-' + g.id"
                            >
                                <div
                                    v-if="getVisualY(g.y) !== null"
                                    class="ghost-item bump-ghost-hatched"
                                    style="z-index: 5; border-style: solid; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font-size: 0.85rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);"
                                    :style="{
                                        transform: `translate(${g.x}px, ${getVisualY(g.y)}px)`,
                                        width: `${g.widthUnits * CELL_SIZE}px`,
                                        height: `${CELL_SIZE}px`,
                                        backgroundColor: g.color || '#ccc',
                                        borderColor: 'rgba(0,0,0,0.5)'
                                    }"
                                >
                                    {{ items.find(i => i.id === g.id)?.name }}
                                </div>
                            </template>
                        </div>

                        <!-- The Draggable Items -->
                        <div
                            v-for="(item, index) in items"
                            v-show="!bumpedItemIds.has(item.id)"
                            :key="item.id"
                            class="draggable-item"
                            :class="{ selected: selectedItemIds.has(item.id) }"
                            :style="getItemStyle(item, index)"
                            @mousedown.stop="startDrag($event, index)"
                        >
                            <div>{{ item.name }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
/* Basic Global Resets */
:root {
  --primary: #3b82f6; 
  --gray: #f3f4f6;
  --dark: #1f2937;
}

body {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  color: #333;
}

/* Bump Ghost HATCHED variant */
.bump-ghost-hatched {
    background-image: repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.4),
        rgba(255, 255, 255, 0.4) 10px,
        transparent 10px,
        transparent 20px
    ) !important;
    background-blend-mode: overlay;
    border: 2px dashed rgba(0,0,0,0.6) !important;
}

.app-layout {
    display: flex;
    flex-direction: row;
    height: calc(100vh - 100px); 
    border-top: 1px solid #ccc;
    position: relative;
    overflow: hidden;
}

button {
    cursor: pointer;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    padding: 6px 12px;
}

.btn-icon {
    border: none;
    background: transparent;
    font-size: 1.5rem; 
    padding: 4px;
}

.btn-primary {
    background: var(--primary);
    color: white;
    border: none;
}
.btn-primary:hover {
    filter: brightness(0.9);
}

.btn-danger {
    background: #ef4444;
    color: white;
    border: none;
}
.btn-danger:hover {
    filter: brightness(0.9);
}

header {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
}

.header-row h1 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--dark);
}

.header-controls {
    display: flex;
    gap: 10px;
}

.toolbar-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: var(--gray);
    border-top: 1px solid #f0f0f0;
}

.instructions {
    color: #6b7280;
    font-size: 0.9rem;
}

.toolbar-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.separator {
    width: 1px;
    height: 24px;
    background: #d1d5db;
    margin: 0 4px;
}

/* Main Content Area */
.main-content {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.grid-header-row {
    display: flex;
    flex-direction: row;
    height: 30px;
    flex-shrink: 0;
    width: 100%;
    z-index: 20;
}

.corner-cell {
    width: 150px;
    height: 100%;
    background: #e5e7eb;
    border-bottom: 1px solid #ccc;
    border-right: 1px solid #ccc;
    flex-shrink: 0;
}

.grid-body-row {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    padding-bottom: 20px; /* Space for horizontal scrollbar if needed */
}

.row-header-container {
    width: 150px;
    overflow: hidden; 
    border-right: 1px solid #ccc;
    background: #f9fafb;
    flex-shrink: 0;
}

.row-label-cell {
    height: 50px; 
    width: 100%;
    display: flex;
    align-items: center;
    padding: 0 10px;
    box-sizing: border-box;
    border-bottom: 1px solid #eee;
    font-size: 0.85rem;
    color: #444;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
}

.row-label-cell:hover {
    background-color: #f3f4f6;
}

.row-label-cell.editing {
    padding: 0;
}

.row-edit-input {
    width: 100%;
    height: 100%;
    border: 2px solid var(--primary);
    padding: 0 8px;
    font-size: 0.85rem;
    outline: none;
}

.axis-header {
    height: 100%;
    flex: 1;
    background: #f0f0f0;
    border-bottom: 1px solid #ccc;
    position: relative;
    overflow: hidden; 
}

.axis-content {
    display: flex;
    height: 100%;
}

.axis-cell {
    width: 50px;
    height: 100%;
    border-right: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: #666;
    background: #fafafa;
    flex-shrink: 0;
    overflow: hidden;
    white-space: nowrap;
}

/* Board */
.board-container {
    position: relative;
    overflow: auto; 
    flex: 1;
    background-color: #f3f4f6; /* Outer gray bg */
    width: 100%;
}

/* Ensure the white content box sizes to the grid exactly */
.board-content {
    position: relative;
    background-color: #fff;
    /* width/height set inline dynamically */
}

.grid-background {
    width: 100%;
    height: 100%;
    background-image: 
        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px);
    background-size: 50px 50px;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
}

.draggable-item {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    padding: 0 5px;
    font-size: 0.85rem;
    color: #fff;
    overflow: hidden;
    white-space: nowrap;
    cursor: grab;
    user-select: none;
    z-index: 10;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    border-radius: 4px;
}

.draggable-item.selected {
    outline: 2px solid #3b82f6 !important;
    outline-offset: 1px;
    z-index: 20; 
}

.ghost-item {
    position: absolute;
    box-sizing: border-box;
    border: 2px dashed #9ca3af;
    background-color: rgba(229, 231, 235, 0.5);
    z-index: 5;
    pointer-events: none;
    border-radius: 4px;
}
</style>
