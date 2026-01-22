<script setup lang="ts">
import { ref } from 'vue';
import DraggableModal from './DraggableModal.vue';

interface GridConfig {
    cols: number;
    rows: number;
    rowDefinitions: Record<string, string>;
}

interface AxisConfig {
    mode: string;
    startDate: string;
    weekdaysOnly?: boolean;
    [key: string]: any;
}

const props = defineProps<{
    isOpen: boolean;
    gridConfig: GridConfig;
    axisConfig: AxisConfig;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', grid: { cols: number, rows: number }, axis: AxisConfig): void;
}>();

const pendingCols = ref(props.gridConfig.cols);
const pendingRows = ref(props.gridConfig.rows);
const pendingAxis = ref({ ...props.axisConfig });

const save = () => {
    emit('save', {
        cols: pendingCols.value,
        rows: pendingRows.value
    }, pendingAxis.value);
};

</script>

<template>
    <DraggableModal
        :is-open="isOpen"
        title="Grid Settings"
        :initial-x="50"
        :initial-y="100"
        @close="emit('close')"
    >
        <div class="grid-editor">
            <div class="form-group">
                <label>Columns (Horizontal)</label>
                <input
                    v-model.number="pendingCols"
                    type="number"
                    min="1"
                >
            </div>
            <div class="form-group">
                <label>Rows (Vertical)</label>
                <input
                    v-model.number="pendingRows"
                    type="number"
                    min="1"
                >
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">

            <!-- Axis Settings -->
            <div class="form-group">
                <label>Horizontal Axis Labels</label>
                <select
                    v-model="pendingAxis.mode"
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
                v-if="pendingAxis.mode !== 'number'"
                class="form-group"
            >
                <label>Start Date</label>
                <input
                    v-model="pendingAxis.startDate"
                    type="date"
                >
            </div>

            <div
                v-if="pendingAxis.mode === 'day'"
                class="form-group"
                style="display: flex; align-items: center; gap: 8px;"
            >
                <input
                    id="wdOnly"
                    v-model="pendingAxis.weekdaysOnly"
                    type="checkbox"
                >
                <label
                    for="wdOnly"
                    style="margin: 0; font-weight: normal;"
                >Weekdays Only</label>
            </div>

            <div
                class="btn-group"
                style="margin-top: 20px;"
            >
                <button
                    class="btn-small btn-primary"
                    @click="save"
                >
                    Apply Changes
                </button>
            </div>
        </div>
    </DraggableModal>
</template>

<style scoped>
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    font-size: 0.9rem;
    color: #4b5563;
    margin-bottom: 4px;
    font-weight: 500;
}

input, select {
    width: 100%;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 0.9rem;
}

input:focus, select:focus {
    outline: none;
    border-color: #3b82f6;
    ring: 2px solid #93c5fd;
}

.btn-group {
    display: flex;
    justify-content: flex-end;
}

.btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
}

.btn-primary:hover {
    background-color: #2563eb;
}
</style>
