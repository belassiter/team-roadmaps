// src/App.ghosts.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App.vue Ghost Visibility', () => {

    it('should show backfill ghosts when Backfill Mode is ON and Bump Mode is OFF', async () => {
        const wrapper = mount(App);
        const vm = wrapper.vm as any;

        // Setup: Backfill ON, Bump OFF
        vm.isBackfillMode = true;
        vm.isBumpMode = false;
        
        // Setup Items: [A][B][C]
        // We must modify the reactive array in place
        vm.items.splice(0, vm.items.length); 
        vm.items.push(
            { id: 1, x: 0, y: 0, widthUnits: 2, name: "A" },
            { id: 2, x: 100, y: 0, widthUnits: 2, name: "B" },
            { id: 3, x: 200, y: 0, widthUnits: 2, name: "C" }
        );

        // Select Item B
        vm.selectedItemIds.clear();
        vm.selectedItemIds.add(2);
        
        // Start Drag B
        // We can simulate startDrag via method call or event. Method is easier.
        // Need to simulate MouseEvent
        const mockEvent = { clientX: 0, clientY: 0, ctrlKey: false, metaKey: false } as MouseEvent;
        // Find index of B (which is 1)
        const indexB = 1;
        vm.startDrag(mockEvent, indexB);
        
        expect(vm.isDragging).toBe(true);

        // Move mouse to invoke updateGhost
        // We drag B to 500 (far away).
        // C should fill B's spot.
        vm.dragOffset = { x: 400, y: 0 }; // B moves 100 -> 500
        vm.updateGhost();
        
        await wrapper.vm.$nextTick();
        
        // Check Logic State
        // bumpGhosts (the unified list) should contain C at x=100.
        const bumpGhosts = vm.bumpGhosts;
        const ghostC = bumpGhosts.find((g: any) => g.id === 3);
        expect(ghostC).toBeDefined();
        expect(ghostC.x).toBe(100);
        
        // Check Visual State
        // Since isBumpMode is FALSE, the "Bump Mode Ghosts" container is hidden.
        // And if we didn't populate backfillGhosts, "Backfill Mode Ghosts" container is hidden (or empty).
        
        // We expect "Backfill Mode Ghosts" container to be present because isBackfillMode is TRUE.
        // But logic currently (buggy) puts ghosts in bumpGhosts only.
        
        // BUG VERIFICATION:
        // Rendered ghosts?
        // Classes: .ghost-item.bump-ghost-hatched
        const renderedGhosts = wrapper.findAll('.bump-ghost-hatched');
        
        // If the bug exists, this will be 0 because bumpGhosts container is hidden (isBumpMode=false)
        // and backfillGhosts is empty.
        expect(renderedGhosts.length).toBeGreaterThan(0);
    });
});
