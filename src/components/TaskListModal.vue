<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Directive } from 'vue';
import { filterItems, sortItems } from '../utils/listHelpers';
import { getGridIndexFromDate, getDateFromGridIndex } from '../utils/gridConverters';
import { generateColorPalette } from '../utils/colors';

interface TaskItem {
    id: number | string;
    name: string;
    x: number;
    y: number;
    widthUnits: number;
    color?: string;
    [key: string]: any;
}

interface AxisConfig {
    mode: string;
    startDate: string;
    [key: string]: any;
}

const props = withDefaults(defineProps<{
    isOpen: boolean;
    items?: TaskItem[];
    axisConfig?: AxisConfig;
    cellSize?: number;
}>(), {
    cellSize: 50,
    items: () => [],
    axisConfig: () => ({ mode: 'number', startDate: '' })
});

const emit = defineEmits<{
    close: []
}>();

const searchQuery = ref('');
const sortKey = ref<string>('name');
const sortOrder = ref<'asc' | 'desc'>('asc');

const vFocus: Directive = {
    mounted: (el) => el.focus()
};

const colorPalette = generateColorPalette();

// --- Editing State ---
const editingId = ref<number | string | null>(null);
const editingField = ref<string | null>(null);
const editValue = ref<any>(null);
const showColorPickerId = ref<number | string | null>(null);

const startEdit = (item: TaskItem, field: string) => {
    editingId.value = item.id;
    editingField.value = field;
    showColorPickerId.value = null; // Close color picker if open

    if (field === 'name') {
        editValue.value = item.name;
    } else if (field === 'y') {
        // Edit Row Number (1-based)
        editValue.value = Math.round(item.y / props.cellSize) + 1;
    } else if (field === 'x') {
        // Edit Start Date or Index
        const gridIndex = Math.round(item.x / props.cellSize);
        if (props.axisConfig.mode === 'number') {
            editValue.value = gridIndex + 1;
        } else {
            // Date format YYYY-MM-DD for input type=date
            const d = getDateFromGridIndex(gridIndex, props.axisConfig.startDate, props.axisConfig.mode);
            // manually format to yyyy-mm-dd
            // d is local time from util
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            editValue.value = `${year}-${month}-${day}`;
        }
    }
};

const commitEdit = (item: TaskItem) => {
    if (editingField.value === 'name') {
        if (editValue.value && String(editValue.value).trim()) {
            item.name = String(editValue.value).trim();
        }
    } else if (editingField.value === 'y') {
        const val = parseInt(editValue.value);
        if (!isNaN(val) && val > 0) {
            item.y = (val - 1) * props.cellSize;
        }
    } else if (editingField.value === 'x') {
        if (props.axisConfig.mode === 'number') {
            const val = parseInt(editValue.value);
            if (!isNaN(val) && val > 0) {
                item.x = (val - 1) * props.cellSize;
            }
        } else {
            // Date mode
            if (editValue.value) {
                // value is yyyy-mm-dd
                const idx = getGridIndexFromDate(editValue.value, props.axisConfig.startDate, props.axisConfig.mode);
                item.x = idx * props.cellSize;
            }
        }
    }

    editingId.value = null;
    editingField.value = null;
    editValue.value = null;
};

const cancelEdit = () => {
    editingId.value = null;
    editingField.value = null;
    editValue.value = null;
};

const toggleColorPicker = (item: TaskItem) => {
    if (showColorPickerId.value === item.id) {
        showColorPickerId.value = null;
    } else {
        showColorPickerId.value = item.id;
        // Close other edits
        editingId.value = null;
    }
};

const selectColor = (item: TaskItem, color: string) => {
    item.color = color;
    showColorPickerId.value = null;
};

// --- Display Helpers ---

const toggleSort = (key: string) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
    }
};

const getDisplayStart = (item: TaskItem) => {
    // Return display value for "Start" column
    const gridIndex = Math.round(item.x / props.cellSize);
    
    if (props.axisConfig.mode === 'number') {
        return gridIndex + 1; // 1-based index
    }
    
    // For date modes: show M/DD/YYYY as requested
    // converted date
    const d = getDateFromGridIndex(gridIndex, props.axisConfig.startDate, props.axisConfig.mode);
    return d.toLocaleDateString('en-US'); 
};

const processedItems = computed(() => {
    let result = filterItems(props.items, searchQuery.value);
    // Cast key to keyof TaskItem to satisfy TS, though sortItems is generic
    // result is TaskItem[]
    return sortItems(result, sortKey.value as keyof TaskItem, sortOrder.value);
});

</script>

<template>
    <div
        v-if="isOpen"
        class="modal-overlay"
        @click.self="emit('close')"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>Task List</h2>
                <button
                    class="close-btn"
                    @click="emit('close')"
                >
                    &times;
                </button>
            </div>
            
            <div class="modal-body">
                <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Search tasks..." 
                    class="search-input"
                >
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th @click="toggleSort('name')">
                                    Name 
                                    <span v-if="sortKey === 'name'">{{ sortOrder === 'asc' ? '' : '' }}</span>
                                </th>
                                <th @click="toggleSort('x')">
                                    Start
                                    <span v-if="sortKey === 'x'">{{ sortOrder === 'asc' ? '' : '' }}</span>
                                </th>
                                <th @click="toggleSort('y')">
                                    Row
                                    <span v-if="sortKey === 'y'">{{ sortOrder === 'asc' ? '' : '' }}</span>
                                </th>
                                <th>Color</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="item in processedItems"
                                :key="item.id"
                            >
                                <!-- NAME COLUMN -->
                                <td
                                    class="editable-cell"
                                    @click="startEdit(item, 'name')"
                                >
                                    <input 
                                        v-if="editingId === item.id && editingField === 'name'"
                                        v-model="editValue"
                                        v-focus
                                        class="edit-input"
                                        @blur="commitEdit(item)"
                                        @keyup.enter="commitEdit(item)"
                                        @keyup.esc="cancelEdit"
                                        @click.stop
                                    >
                                    <span v-else>{{ item.name }}</span>
                                </td>

                                <!-- START COLUMN -->
                                <td
                                    class="editable-cell"
                                    @click="startEdit(item, 'x')"
                                >
                                    <div
                                        v-if="editingId === item.id && editingField === 'x'"
                                        @click.stop
                                    >
                                        <input 
                                            v-if="axisConfig.mode === 'number'"
                                            v-model="editValue"
                                            type="number"
                                            class="edit-input"
                                            @blur="commitEdit(item)"
                                            @keyup.enter="commitEdit(item)"
                                        >
                                        <input 
                                            v-else
                                            v-model="editValue"
                                            type="date"
                                            class="edit-input"
                                            @change="commitEdit(item)" 
                                            @blur="cancelEdit"
                                        >
                                    </div>
                                    <span v-else>{{ getDisplayStart(item) }}</span>
                                </td>

                                <!-- ROW COLUMN -->
                                <td
                                    class="editable-cell"
                                    @click="startEdit(item, 'y')"
                                >
                                    <input 
                                        v-if="editingId === item.id && editingField === 'y'"
                                        v-model="editValue"
                                        type="number"
                                        class="edit-input"
                                        @blur="commitEdit(item)"
                                        @keyup.enter="commitEdit(item)"
                                        @click.stop
                                    >
                                    <span v-else>{{ Math.round(item.y / props.cellSize) + 1 }}</span>
                                </td>

                                <!-- COLOR COLUMN -->
                                <td style="position: relative;">
                                    <div 
                                        class="color-dot" 
                                        :style="{ backgroundColor: item.color }"
                                        @click.stop="toggleColorPicker(item)"
                                    />
                                    
                                    <!-- Color Picker Popup -->
                                    <div
                                        v-if="showColorPickerId === item.id"
                                        class="color-picker-popup"
                                        @click.stop
                                    >
                                        <div 
                                            v-for="color in colorPalette" 
                                            :key="color" 
                                            class="picker-swatch"
                                            :style="{ backgroundColor: color }"
                                            @click="selectColor(item, color)"
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="processedItems.length === 0">
                                <td
                                    colspan="4"
                                    style="text-align: center; color: #888;"
                                >
                                    No tasks found.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    width: 800px;
    max-width: 90%;
    max-height: 80vh;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
}

.modal-header {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
}

.modal-body {
    padding: 20px;
    overflow-y: auto;
    /* Ensure popup clipping doesn't hide color picker depending on table size */
    /* Though table overflow might clip it. Fixed positioning or Portal is better, 
       but for POC relative is okay if table has room. */
    min-height: 300px;
}

.search-input {
    width: 100%;
    padding: 8px;
    margin-bottom: 15px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
}

.table-container {
    border: 1px solid #eee;
    border-radius: 4px;
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
}

th {
    background: #f9f9f9;
    cursor: pointer;
    user-select: none;
}

th:hover {
    background: #f0f0f0;
}

.color-dot {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(0,0,0,0.1);
    cursor: pointer;
}

.editable-cell {
    cursor: text;
}
.editable-cell:hover {
    background-color: #fafafa;
}

.edit-input {
    width: 100%;
    padding: 4px;
    box-sizing: border-box;
    font-family: inherit;
    font-size: inherit;
}

.color-picker-popup {
    position: absolute;
    top: 30px;
    right: 0;
    background: white;
    border: 1px solid #ccc;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    z-index: 100;
    width: 200px;
}

.picker-swatch {
    width: 20px;
    height: 20px;
    border-radius: 2px;
    cursor: pointer;
}
.picker-swatch:hover {
    transform: scale(1.1);
    box-shadow: 0 0 2px rgba(0,0,0,0.3);
}
</style>
