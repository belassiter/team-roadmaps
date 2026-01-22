<script setup lang="ts">
/* eslint-disable vue/no-mutating-props */
import DraggableModal from './DraggableModal.vue';
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

defineProps<{
    item: TaskItem | null;
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'update'): void; // Just signal change
}>();

const colorPalette = generateColorPalette();
const initialX = typeof window !== 'undefined' ? window.innerWidth - 350 : 500;
</script>

<template>
    <DraggableModal
        :is-open="isOpen && !!item"
        :title="item ? 'Edit ' + item.name : 'Edit Item'"
        :initial-x="initialX"
        :initial-y="100"
        @close="emit('close')"
    >
        <div v-if="item">
            <div class="form-group">
                <label>Name</label>
                <input
                    v-model="item.name"
                    type="text"
                    @input="emit('update')"
                >
            </div>

            <div class="form-group">
                <label>Length (Grid Units)</label>
                <input
                    v-model.number="item.widthUnits"
                    type="number"
                    min="1"
                    step="1"
                    @input="emit('update')"
                >
            </div>

            <div class="form-group">
                <label>Color</label>
                <div class="color-palette">
                    <div
                        v-for="color in colorPalette"
                        :key="color"
                        class="color-swatch"
                        :class="{ active: item.color === color }"
                        :style="{ backgroundColor: color }"
                        @click="() => { if(item) { item.color = color; emit('update'); } }"
                    />
                </div>
            </div>
            
            <div class="info-group">
                <small>ID: {{ item.id }}</small>
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

input {
    width: 100%;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    box-sizing: border-box;
    font-size: 0.9rem;
}

.color-palette {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-top: 8px;
}

.color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
}

.color-swatch.active {
    border-color: #333;
    transform: scale(1.1);
}

.info-group {
    margin-top: 20px;
    border-top: 1px solid #eee;
    padding-top: 10px;
    color: #999;
}
</style>
