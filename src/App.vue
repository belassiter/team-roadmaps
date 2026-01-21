<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { formatDate, parseLocalYMD } from './utils/dates';
import { checkCollision, findClosestValidPosition } from './utils/physics';

// --- Configuration ---
const CELL_SIZE = 50; // Fixed cell size

const gridConfig = reactive({
    cols: 20,
    rows: 5
});

// Computed grid dimensions
const gridWidth = computed(() => gridConfig.cols * CELL_SIZE);
const gridHeight = computed(() => gridConfig.rows * CELL_SIZE);

// --- Axis Settings ---
const axisConfig = reactive({
    mode: 'number', // number, day, week
    startDate: new Date().toISOString().substring(0, 10), // string YYYY-MM-DD
    weekdaysOnly: false
});

const axisLabels = computed(() => {
    const labels = [];
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
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);

const draggingItemIndex = ref(null);
const selectedItemId = ref(1);

const items = reactive([
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

const colorPalette = computed(() => {
    const colors = [];
    const hueValues = [0, 30, 45, 120, 180, 210, 270, 320];
    const lightnessValues = [30, 45, 60, 75, 90];
    
    for (let l of lightnessValues) {
        for (let h of hueValues) {
            colors.push(`hsl(${h}, 85%, ${l}%)`);
        }
    }
    return colors;
});

const ghost = reactive({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    color: 'transparent',
    visible: false
});

// --- History / Undo ---
const history = ref([]);

const saveHistory = () => {
    history.value.push(JSON.parse(JSON.stringify(items)));
    if (history.value.length > 50) history.value.shift();
};

const undo = () => {
    if (history.value.length === 0) return;
    const previousState = history.value.pop();
    items.splice(0, items.length, ...previousState);
    selectedItemId.value = null;
};

// --- Methods ---

const getItemStyle = (item, index) => {
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
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    
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

    const newItem = {
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

// Removed local checkCollision definition

const startDrag = (event, index) => {
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

const onDrag = (event) => {
    if (!isDragging.value) return;

    const dx = event.clientX - startX.value;
    const dy = event.clientY - startY.value;

    dragOffset.value = { x: dx, y: dy };
    updateGhost(); 
};

const updateGhost = () => {
    const index = draggingItemIndex.value;
    if (index === null) return;
    
    const item = items[index];

    let finalRawX = item.x + dragOffset.value.x;
    let finalRawY = item.y + dragOffset.value.y;

    let snappedPosX = Math.round(finalRawX / CELL_SIZE) * CELL_SIZE;
    let snappedPosY = Math.round(finalRawY / CELL_SIZE) * CELL_SIZE;

    snappedPosX = Math.max(0, snappedPosX);
    snappedPosY = Math.max(0, snappedPosY);
    
    const itemPxWidth = item.widthUnits * CELL_SIZE;
    snappedPosX = Math.min(snappedPosX, gridWidth.value - itemPxWidth);
    snappedPosY = Math.min(snappedPosY, gridHeight.value - CELL_SIZE);

    const candidate = { 
        id: item.id, 
        x: snappedPosX, 
        y: snappedPosY, 
        widthUnits: item.widthUnits 
    };

    // Pass CELL_SIZE
    const isCollision = checkCollision(candidate, items, CELL_SIZE);

    if (isCollision) {
        // Pass all required params
        const closestValid = findClosestValidPosition(
            item.id, 
            items, 
            snappedPosX, 
            snappedPosY, 
            item.widthUnits, 
            CELL_SIZE,
            gridWidth.value,
            gridHeight.value
        );
        ghost.x = closestValid.x;
        ghost.y = closestValid.y;
    } else {
        ghost.x = snappedPosX;
        ghost.y = snappedPosY;
    }

    ghost.width = itemPxWidth;
    ghost.height = CELL_SIZE;
    ghost.color = item.color;
    ghost.visible = true;
};

// Removed local findClosestValidPosition definition

const stopDrag = () => {
    if (!isDragging.value) return;
    
    const index = draggingItemIndex.value;
    const item = items[index];

    if (ghost.visible) {
        if (item.x !== ghost.x || item.y !== ghost.y) {
            saveHistory();
        }

        item.x = ghost.x;
        item.y = ghost.y;
    }

    isDragging.value = false;
    draggingItemIndex.value = null;
    dragOffset.value = { x: 0, y: 0 };
    ghost.visible = false;

    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
};

// --- Persistence (Save/Load) ---
const fileInput = ref(null);

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
    const pad = (n) => String(n).padStart(2, '0');
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

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
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

        } catch (err) {
            console.error("Failed to load project:", err);
            alert("Error loading file. It may be corrupted or invalid JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};

// --- Lifecycle ---
const handleKeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});

</script>

<template>
<header>
    <div class="header-row">
        <h1>Project Planner POC</h1>
        <div class="header-controls">
            <button class="btn-primary" @click="saveProject">Save</button>
            <button class="btn-secondary" @click="triggerLoad">Load</button>
            <!-- Hidden file input for loading -->
            <input 
                type="file" 
                ref="fileInput" 
                style="display: none" 
                accept=".json" 
                @change="handleFileUpload"
            >
        </div>
    </div>
    <p>Drag the rectangle. Click to edit its properties.</p>
    <div class="stats">
        Grid: X: {{ snappedX }} / Y: {{ snappedY }} | Items: {{ items.length }}
    </div>
</header>

<div class="app-layout">
    <!-- The Board Area (Scrollable Wrapper) -->
    <div class="main-content">
        <!-- Sticky Header -->
        <div class="axis-header" :style="{ width: gridWidth + 'px' }">
            <div 
                v-for="(label, index) in axisLabels" 
                :key="index" 
                class="axis-cell"
                :title="label"
            >
                {{ label }}
            </div>
        </div>

        <!-- Board -->
        <div 
            class="board-container" 
            ref="board" 
            @click.self="selectedItemId = null"
            :style="{ width: gridWidth + 'px', height: gridHeight + 'px' }"
        >
            
            <!-- The Grid Background -->
            <!-- Clicking background deselects item -->
            <div class="grid-background" @click="selectedItemId = null"></div>

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
            ></div>

            <!-- The Draggable Items -->
            <div 
                v-for="(item, index) in items"
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

    <!-- Editor Panel -->
    <div class="sidebar">
        
        <!-- Grid Settings Box -->
        <div class="sidebar-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h2 style="margin: 0; border: none; font-size: 1.1rem;">Grid Settings</h2>
                <button v-if="!isEditingGrid" class="btn-small" @click="openGridEditor">Edit Grid</button>
            </div>

            <div v-if="isEditingGrid" class="grid-editor">
                <div class="form-group">
                    <label>Columns (Horizontal)</label>
                    <input type="number" v-model.number="pendingGrid.cols" min="1">
                </div>
                <div class="form-group">
                    <label>Rows (Vertical)</label>
                    <input type="number" v-model.number="pendingGrid.rows" min="1">
                </div>

                <!-- Axis Settings -->
                <div class="form-group">
                    <label>Horizontal Axis Labels</label>
                    <select v-model="axisConfig.mode" style="width: 100%; padding: 8px; margin-bottom: 8px;">
                        <option value="number">Number (1, 2, ...)</option>
                        <option value="day">Day (Date)</option>
                        <option value="week">Week (Number)</option>
                    </select>
                </div>

                <div v-if="axisConfig.mode !== 'number'" class="form-group">
                    <label>Start Date</label>
                    <input type="date" v-model="axisConfig.startDate">
                </div>

                <div v-if="axisConfig.mode === 'day'" class="form-group" style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="wdOnly" v-model="axisConfig.weekdaysOnly">
                    <label for="wdOnly" style="margin: 0; font-weight: normal;">Weekdays Only</label>
                </div>
                
                <div v-if="gridError" class="error-msg">
                    {{ gridError }}
                </div>

                <div class="btn-group">
                    <button class="btn-small btn-primary" @click="saveGridEditor">Save</button>
                    <button class="btn-small btn-secondary" @click="cancelGridEditor">Cancel</button>
                </div>
            </div>
            <div v-else>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">
                    {{ gridConfig.cols }} x {{ gridConfig.rows }}
                </p>
            </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

        <button class="btn" @click="addItem">Add Work Item</button>

        <div v-if="selectedItem">
            <h2>Edit Work Item</h2>
            
            <div class="form-group">
                <label>Name</label>
                <input type="text" v-model="selectedItem.name" @focus="saveHistory">
            </div>

            <div class="form-group">
                <label>Length (Grid Units)</label>
                <input 
                    type="number" 
                    v-model.number="selectedItem.widthUnits" 
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
                <div class="color-palette" @mousedown="saveHistory">
                    <div 
                        v-for="color in colorPalette" 
                        :key="color"
                        class="color-swatch"
                        :class="{ active: selectedItem.color === color }"
                        :style="{ backgroundColor: color }"
                        @click="selectedItem.color = color"
                    ></div>
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
