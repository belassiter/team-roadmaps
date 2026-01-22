<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { formatDate, parseLocalYMD } from './utils/dates';
import { checkCollision, findClosestValidPosition, resolveBumps, resolveBackfill, calculateLayoutOutcome, type PhysicsItem } from './utils/physics';
import { generateColorPalette } from './utils/colors'; 
import TaskListModal from './components/TaskListModal.vue';

// --- Interfaces ---
interface TaskItem extends PhysicsItem {
    name: string;
    color?: string;
    [key: string]: any;
}

interface GridConfig {
    cols: number;
    rows: number;
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
    rows: 5
});

// Computed grid dimensions
const gridWidth = computed(() => gridConfig.cols * CELL_SIZE);
const gridHeight = computed(() => gridConfig.rows * CELL_SIZE);

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

// --- Grid Editor State ---
const isEditingGrid = ref(false);
const pendingGrid = reactive({ cols: 20, rows: 5 });
const gridError = ref('');

const openGridEditor = () => {
    pendingGrid.cols = gridConfig.cols;
    pendingGrid.rows = gridConfig.rows;
    gridError.value = '';
    isEditingGrid.value = true;
};

const saveGridEditor = () => {
    const newW = pendingGrid.cols * CELL_SIZE;
    const newH = pendingGrid.rows * CELL_SIZE;

    // Validate against existing items
    for (const item of items) {
        const itemRight = item.x + (item.widthUnits * CELL_SIZE);
        const itemBottom = item.y + CELL_SIZE;

        if (itemRight > newW) {
            gridError.value = `Error: Item "${item.name}" would be cut off horizontally.`;
            return;
        }
        if (itemBottom > newH) {
            gridError.value = `Error: Item "${item.name}" would be cut off vertically.`;
            return;
        }
    }

    gridConfig.cols = pendingGrid.cols;
    gridConfig.rows = pendingGrid.rows;
    isEditingGrid.value = false;
};

const cancelGridEditor = () => {
    isEditingGrid.value = false;
    gridError.value = '';
};

// --- State ---
const boardContainer = ref<HTMLElement | null>(null);
const axisHeader = ref<HTMLElement | null>(null);

const handleScroll = () => {
    if (boardContainer.value && axisHeader.value) {
        axisHeader.value.scrollLeft = boardContainer.value.scrollLeft;
    }
};

const isDragging = ref(false);
const isBumpMode = ref(false);
const isBackfillMode = ref(false);
const bumpGhosts = ref<PhysicsItem[]>([]); 
const backfillGhosts = ref<PhysicsItem[]>([]); 

const startX = ref(0);
const startY = ref(0);

const draggingItemIndex = ref<number | null>(null);
const selectedItemId = ref<number | string | null>(1);

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
    return items.find(item => item.id === selectedItemId.value);
});

const activeItem = computed(() => {
    if (draggingItemIndex.value !== null) return items[draggingItemIndex.value];
    return selectedItem.value || items[0];
});

const activeItemVisualX = computed(() => {
    if (draggingItemIndex.value !== null) {
        return items[draggingItemIndex.value].x + dragOffset.value.x;
    }
    return activeItem.value ? activeItem.value.x : 0;
});

const activeItemVisualY = computed(() => {
    if (draggingItemIndex.value !== null) {
        return items[draggingItemIndex.value].y + dragOffset.value.y;
    }
    return activeItem.value ? activeItem.value.y : 0;
});

const snappedX = computed(() => Math.round(activeItemVisualX.value / CELL_SIZE));
const snappedY = computed(() => Math.round(activeItemVisualY.value / CELL_SIZE));

const colorPalette = computed(() => generateColorPalette());

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
        selectedItemId.value = null;
    }
};

// --- Methods ---

const getItemStyle = (item: TaskItem, index: number) => {
    const isBeingDragged = draggingItemIndex.value === index;
    
    let x = item.x;
    let y = item.y;
    
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
    selectedItemId.value = newId;
};

const startDrag = (event: MouseEvent, index: number) => {
    if (draggingItemIndex.value !== null) return; 

    draggingItemIndex.value = index;
    selectedItemId.value = items[index].id; 
    
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
    backfillGhosts.value = []; 
    // We will use bumpGhosts as the unified list of "Simulated World Items" 
    // whether they are bumped, backfilled, or stationary.

    const index = draggingItemIndex.value;
    if (index === null) return;
    
    const item = items[index];

    let finalRawX = item.x + dragOffset.value.x;
    let finalRawY = item.y + dragOffset.value.y;

    let snappedPosX = Math.round(finalRawX / CELL_SIZE) * CELL_SIZE;
    let snappedPosY = Math.round(finalRawY / CELL_SIZE) * CELL_SIZE;

    snappedPosX = Math.max(0, snappedPosX);
    snappedPosY = Math.max(0, snappedPosY);
    
    // In Bump Mode, we allow unlimited expansion to the right
    if (!isBumpMode.value) {
        const itemPxWidth = item.widthUnits * CELL_SIZE;
        snappedPosX = Math.min(snappedPosX, gridWidth.value - itemPxWidth);
    }
    snappedPosY = Math.min(snappedPosY, gridHeight.value - CELL_SIZE);

    // --- Unified Layout Calculation ---
    const outcome = calculateLayoutOutcome(
        item.id,
        snappedPosX,
        snappedPosY,
        items,
        CELL_SIZE,
        {
            isBackfillMode: isBackfillMode.value,
            isBumpMode: isBumpMode.value,
            gridWidth: gridWidth.value,
            gridHeight: gridHeight.value,
        }
    );

    // 1. Update the Main Ghost (The Dragged Item)
    const draggedGhost = outcome.draggedItem;
    ghost.x = draggedGhost.x;
    ghost.y = draggedGhost.y;
    ghost.width = draggedGhost.widthUnits * CELL_SIZE;
    ghost.height = CELL_SIZE;
    ghost.color = item.color || '#ccc';
    ghost.visible = true;

    // 2. Update the "Environmental" Ghosts (Bumps / Backfills)
    // bumpedItemIds will automatically filter this list to show only changed items
    bumpGhosts.value = outcome.items;

    // Check grid expansion from the outcome
    let maxRight = 0;
    // Include the ghost itself
    maxRight = Math.max(maxRight, ghost.x + ghost.width);
    
    outcome.items.forEach(p => {
        const r = p.x + (p.widthUnits * CELL_SIZE);
        if (r > maxRight) maxRight = r;
    });
    
    if (maxRight > gridWidth.value) {
        gridConfig.cols = Math.ceil(maxRight / CELL_SIZE);
    }
};

const stopDrag = () => {
    if (!isDragging.value) return;
    
    // Recalculate everything one last time to ensure consistency with what was shown
    // or just trust the ghosts?
    // Safer to recalculate using the exact logic, as updateGhost depends on mousemove
    
    const index = draggingItemIndex.value;
    if (index !== null) {
        const item = items[index];

        // We use the same 'snapped' logic as updateGhost to determine target
        // (Copied logic to ensure match)
        let finalRawX = item.x + dragOffset.value.x;
        let finalRawY = item.y + dragOffset.value.y;
        let snappedPosX = Math.round(finalRawX / CELL_SIZE) * CELL_SIZE;
        let snappedPosY = Math.round(finalRawY / CELL_SIZE) * CELL_SIZE;
        snappedPosX = Math.max(0, snappedPosX);
        snappedPosY = Math.max(0, snappedPosY);
        if (!isBumpMode.value) {
            const itemPxWidth = item.widthUnits * CELL_SIZE;
            snappedPosX = Math.min(snappedPosX, gridWidth.value - itemPxWidth);
        }
        snappedPosY = Math.min(snappedPosY, gridHeight.value - CELL_SIZE);

        // Check if we actually moved visuals? 
        // Logic: if ghost is visible, we commit to GHOST position.
        // But calculateLayoutOutcome returns the valid position.
        
        // Let's run the calc.
        const outcome = calculateLayoutOutcome(
            item.id,
            snappedPosX,
            snappedPosY,
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
            // Apply changes
            // Detect if anything changed to save history
            let changed = false;

            // 1. Dragged Item
            if (item.x !== outcome.draggedItem.x || item.y !== outcome.draggedItem.y) {
                changed = true;
            }

            // 2. Others (Bumps / Backfills)
            outcome.items.forEach(newItemState => {
                const realItem = items.find(i => i.id === newItemState.id);
                if (realItem) {
                    if (realItem.x !== newItemState.x || realItem.y !== newItemState.y) {
                        changed = true;
                    }
                }
            });

            if (changed) {
                saveHistory();
                
                // Commit Dragged Item
                item.x = outcome.draggedItem.x;
                item.y = outcome.draggedItem.y;

                // Commit Others
                outcome.items.forEach(newItemState => {
                    const realItem = items.find(i => i.id === newItemState.id);
                    if (realItem) {
                        realItem.x = newItemState.x;
                        realItem.y = newItemState.y;
                    }
                });
            }
        }
    }

    isDragging.value = false;
    draggingItemIndex.value = null;
    dragOffset.value = { x: 0, y: 0 };
    ghost.visible = false;
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
                }

                if (data.axisConfig) {
                    Object.assign(axisConfig, data.axisConfig);
                }
                
                selectedItemId.value = null;
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
    }
};

const isListModalOpen = ref(false);

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
        @close="isListModalOpen = false"
    />
    <header>
        <div class="header-row">
            <h1>Project Planner POC</h1>
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
        <p>Drag the rectangle. Click to edit its properties.</p>
        <div class="stats">
            Grid: X: {{ snappedX }} / Y: {{ snappedY }} | Items: {{ items.length }}
            <button
                class="btn-secondary"
                style="margin-left: 20px; font-weight: bold;"
                :style="{ color: isBumpMode ? 'green' : 'red' }"
                @click="toggleBumpMode"
            >
                Bump Mode: {{ isBumpMode ? 'ON' : 'OFF' }}
            </button>
            <button
                class="btn-secondary"
                style="margin-left: 10px; font-weight: bold;"
                :style="{ color: isBackfillMode ? 'blue' : 'gray' }"
                @click="isBackfillMode = !isBackfillMode"
            >
                Backfill: {{ isBackfillMode ? 'ON' : 'OFF' }}
            </button>
        </div>
    </header>

    <div class="app-layout">
        <!-- The Board Area (Scrollable Wrapper) -->
        <div class="main-content">
            <!-- Sticky Header -->
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

            <!-- Board -->
            <div
                ref="boardContainer"
                class="board-container"
                @scroll="handleScroll"
                @click.self="selectedItemId = null"
            >
                <div
                    class="board-content"
                    :style="{ width: gridWidth + 'px', height: gridHeight + 'px' }"
                >
                    <!-- The Grid Background -->
                    <!-- Clicking background deselects item -->
                    <div
                        class="grid-background"
                        @click="selectedItemId = null"
                    />

                    <!-- The Ghost Item -->
                    <div 
                        v-if="isDragging && ghost.visible"
                        class="ghost-item"
                        :style="{
                            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
                            width: `${ghost.width}px`,
                            height: `${ghost.height}px`,
                            borderColor: ghost.color,
                            backgroundColor: ghost.color
                        }"
                    />

                    <!-- The Bump Mode Ghosts -->
                    <div 
                        v-if="isBumpMode && bumpGhosts.length > 0"
                    >
                        <!-- We only show ghosts for items that are actually bumped (id in bumpedItemIds) OR the candidate ghost -->
                        <!-- Actually, the candidate ghost logic is separate. -->
                        <template
                            v-for="g in bumpGhosts"
                            :key="'bump-ghost-' + g.id"
                        >
                            <div
                                v-if="bumpedItemIds.has(g.id)"
                                class="ghost-item bump-ghost-hatched"
                                style="z-index: 5; border-style: solid; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font-size: 0.85rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);"
                                :style="{
                                    transform: `translate(${g.x}px, ${g.y}px)`,
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
                                class="ghost-item bump-ghost-hatched"
                                style="z-index: 5; border-style: solid; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font-size: 0.85rem; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);"
                                :style="{
                                    transform: `translate(${g.x}px, ${g.y}px)`,
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
                        :class="{ selected: selectedItemId === item.id }"
                        :style="getItemStyle(item, index)"
                        @mousedown.stop="startDrag($event, index)"
                    >
                        <div>{{ item.name }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Editor Panel -->
        <div class="sidebar">
            <!-- Grid Settings Box -->
            <div class="sidebar-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2 style="margin: 0; border: none; font-size: 1.1rem;">
                        Grid Settings
                    </h2>
                    <button
                        v-if="!isEditingGrid"
                        class="btn-small"
                        @click="openGridEditor"
                    >
                        Edit Grid
                    </button>
                </div>

                <div
                    v-if="isEditingGrid"
                    class="grid-editor"
                >
                    <div class="form-group">
                        <label>Columns (Horizontal)</label>
                        <input
                            v-model.number="pendingGrid.cols"
                            type="number"
                            min="1"
                        >
                    </div>
                    <div class="form-group">
                        <label>Rows (Vertical)</label>
                        <input
                            v-model.number="pendingGrid.rows"
                            type="number"
                            min="1"
                        >
                    </div>

                    <!-- Axis Settings -->
                    <div class="form-group">
                        <label>Horizontal Axis Labels</label>
                        <select
                            v-model="axisConfig.mode"
                            style="width: 100%; padding: 8px; margin-bottom: 8px;"
                        >
                            <option value="number">
                                Number (1, 2, ...)
                            </option>
                            <option value="day">
                                Day (Date)
                            </option>
                            <option value="week">
                                Week (Number)
                            </option>
                        </select>
                    </div>

                    <div
                        v-if="axisConfig.mode !== 'number'"
                        class="form-group"
                    >
                        <label>Start Date</label>
                        <input
                            v-model="axisConfig.startDate"
                            type="date"
                        >
                    </div>

                    <div
                        v-if="axisConfig.mode === 'day'"
                        class="form-group"
                        style="display: flex; align-items: center; gap: 8px;"
                    >
                        <input
                            id="wdOnly"
                            v-model="axisConfig.weekdaysOnly"
                            type="checkbox"
                        >
                        <label
                            for="wdOnly"
                            style="margin: 0; font-weight: normal;"
                        >Weekdays Only</label>
                    </div>

                    <div
                        v-if="gridError"
                        class="error-msg"
                    >
                        {{ gridError }}
                    </div>

                    <div class="btn-group">
                        <button
                            class="btn-small btn-primary"
                            @click="saveGridEditor"
                        >
                            Save
                        </button>
                        <button
                            class="btn-small btn-secondary"
                            @click="cancelGridEditor"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                <div v-else>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">
                        {{ gridConfig.cols }} x {{ gridConfig.rows }}
                    </p>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

            <button
                class="btn"
                @click="addItem"
            >
                Add Work Item
            </button>

            <div v-if="selectedItem">
                <h2>Edit Work Item</h2>

                <div class="form-group">
                    <label>Name</label>
                    <input
                        v-model="selectedItem.name"
                        type="text"
                        @focus="saveHistory"
                    >
                </div>

                <div class="form-group">
                    <label>Length (Grid Units)</label>
                    <input
                        v-model.number="selectedItem.widthUnits"
                        type="number"
                        min="1"
                        step="1"
                        @focus="saveHistory"
                    >
                    <small style="color: #888; display: block; margin-top: 4px;">
                        Width in px: {{ selectedItem.widthUnits * 50 }}px
                    </small>
                </div>

                <div class="form-group">
                    <label>Color</label>
                    <div
                        class="color-palette"
                        @mousedown="saveHistory"
                    >
                        <div
                            v-for="color in colorPalette"
                            :key="color"
                            class="color-swatch"
                            :class="{ active: selectedItem.color === color }"
                            :style="{ backgroundColor: color }"
                            @click="selectedItem.color = color"
                        />
                    </div>
                </div>
            </div>
            <div v-else>
                <p style="color: #666; text-align: center; margin-top: 50px;">
                    Select an item to edit
                </p>
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
    /* Using a repeating linear gradient to create diagonal stripes */
    /* We used background-image to overlay on top of the background-color set inline */
    background-image: repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.4),
        rgba(255, 255, 255, 0.4) 10px,
        transparent 10px,
        transparent 20px
    ) !important;
    
    /* Ensure the color beneath shows through */
    background-blend-mode: overlay;
    
    /* Strong dashed border */
    border: 2px dashed rgba(0,0,0,0.6) !important;
}

.app-layout {
    display: flex;
    flex-direction: row;
    height: calc(100vh - 100px); /* Fill remaining usage */
    border-top: 1px solid #ccc;
}

button {
    cursor: pointer;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
}

.header-controls {
    display: flex;
    gap: 10px;
}

header {
    background: var(--gray);
    padding: 10px 0;
    border-bottom: 1px solid #ddd;
}

header h1 {
    margin: 0;
    font-size: 1.5rem;
}

header p {
    margin: 5px 20px 0;
    color: #666;
    font-size: 0.9rem;
}

.stats {
    padding: 5px 20px; 
    font-family: 'Consolas', monospace; 
    font-size: 0.9rem; 
    color: #444;
}

/* Sidebar */
.sidebar {
    width: 300px;
    background: #f9fafb;
    border-left: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow-y: auto;
    flex-shrink: 0;
}

.sidebar-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 20px;
}

/* Main Content Area */
.main-content {
    flex: 1;
    position: relative;
    overflow: hidden; /* Hide scrollbars of the container */
    display: flex;
    flex-direction: column;
}

.axis-header {
    height: 30px;
    background: #f0f0f0;
    border-bottom: 1px solid #ccc;
    position: relative;
    overflow: hidden; /* Hide scrollbars */
    flex-shrink: 0;
}

.axis-content {
    display: flex;
    height: 100%;
}

.axis-cell {
    width: 50px; /* CELL_SIZE */
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
    overflow: auto; /* Allow scrolling */
    flex: 1;
    background-color: #fff;
    width: 100%;
}

.board-content {
    position: relative;
    background-color: #fff;
}

.grid-background {
    width: 100%;
    height: 100%;
    background-image: 
        linear-gradient(to right, #ccc 1px, transparent 1px),
        linear-gradient(to bottom, #ccc 1px, transparent 1px);
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
    border-radius: 4px;
    cursor: move;
    font-size: 0.85rem;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    user-select: none;
    transition: transform 0.1s;
}

.draggable-item.selected {
    box-shadow: 0 0 0 2px #2563eb, 0 4px 6px rgba(0,0,0,0.2);
    z-index: 10;
}

.ghost-item {
    position: absolute;
    box-sizing: border-box;
    border: 2px dashed #999;
    border-radius: 4px;
    pointer-events: none;
    z-index: 5;
    opacity: 0.6;
}

/* Forms */
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
}

.form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    box-sizing: border-box;
}

.color-options {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.color-swatch {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
}

.color-swatch.active {
    border-color: #333;
}

.btn {
    display: block;
    width: 100%;
    padding: 10px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
    font-weight: 500;
}

.btn:hover {
    opacity: 0.9;
}

.btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    padding: 5px 15px;
    border-radius: 4px;
    font-weight: 500;
}

.btn-secondary {
    background: #fff;
    color: #374151;
    border: 1px solid #d1d5db;
    padding: 5px 15px;
    border-radius: 4px;
    font-weight: 500;
}

.btn-small {
    padding: 4px 10px;
    font-size: 0.8rem;
}

.btn-group {
    display: flex;
    gap: 10px;
    margin-top: 10px;
}
</style>
