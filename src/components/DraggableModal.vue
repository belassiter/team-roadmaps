<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    title: string;
    initialX?: number;
    initialY?: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void
}>();

const x = ref(props.initialX || 100);
const y = ref(props.initialY || 100);
const modalRef = ref<HTMLElement | null>(null);

const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const startDrag = (e: MouseEvent) => {
    isDragging.value = true;
    dragOffset.value = {
        x: e.clientX - x.value,
        y: e.clientY - y.value
    };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;
    x.value = e.clientX - dragOffset.value.x;
    y.value = e.clientY - dragOffset.value.y;
};

const stopDrag = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
};

</script>

<template>
    <div
        v-if="isOpen"
        ref="modalRef"
        class="draggable-modal"
        :style="{ top: y + 'px', left: x + 'px' }"
    >
        <div 
            class="modal-header"
            @mousedown="startDrag"
        >
            <h3>{{ title }}</h3>
            <button 
                class="close-btn"
                @click="emit('close')"
            >
                &times;
            </button>
        </div>
        <div class="modal-content-body">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.draggable-modal {
    position: fixed;
    background: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    z-index: 100;
    min-width: 300px;
}

.modal-header {
    padding: 12px 16px;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    border-radius: 8px 8px 0 0;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #1f2937;
}

.close-btn {
    border: none;
    background: transparent;
    font-size: 1.25rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0 4px;
}

.close-btn:hover {
    color: #1f2937;
}

.modal-content-body {
    padding: 16px;
}
</style>
