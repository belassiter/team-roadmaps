// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

// Mock ResizeObserver for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App.vue', () => {
    it('should render the board container and content', () => {
        const wrapper = mount(App);
        
        // Assert the new structure exists
        const boardContainer = wrapper.find('.board-container');
        expect(boardContainer.exists()).toBe(true);
        
        const boardContent = wrapper.find('.board-content');
        expect(boardContent.exists()).toBe(true);
        
        const gridBackground = wrapper.find('.grid-background');
        expect(gridBackground.exists()).toBe(true);
    });
    
    it('should match header scroll with board scroll', async () => {
        const wrapper = mount(App);
        const boardContainer = wrapper.find('.board-container');
        const axisHeader = wrapper.find('.axis-header');
        
        expect(boardContainer.exists()).toBe(true);
        expect(axisHeader.exists()).toBe(true);
        
        // Simulate scroll
        // Note: JSDOM doesn't actually layout, so scrollWidth/Left might depend on mocks or be 0.
        // We can just check if the handler is attached and calls the logic.
        // Or trigger the event and check style/prop updates if any?
        // In this case, the handler updates 'axisHeader.value.scrollLeft'.
        // We can mimic this by setting scrollLeft on the element and triggering event.
        
        // Manually set scrollLeft on the DOM element
        boardContainer.element.scrollLeft = 50;
        await boardContainer.trigger('scroll');
        
        // Check if logic propagated
        // Note: changing element.scrollLeft in JSDOM works, but the sync logic depends on the Vue refs.
        // mount attaches refs.
        
        // We assert that the handler executed. Since we can't easily spy on the internal function in <script setup>,
        // we might verify the side effect.
        expect(axisHeader.element.scrollLeft).toBe(50);
    });

    it('should add a new task item when clicking "Add Work Item"', async () => {
        const wrapper = mount(App);
        
        // Initial count
        const initialItems = wrapper.findAll('.draggable-item').length;
        
        // Find Add button
        const buttons = wrapper.findAll('button');
        const addButton = buttons.find(b => b.text() === 'Add Work Item');
        
        expect(addButton?.exists()).toBe(true);
        await addButton?.trigger('click');
        
        // Check count increased
        const newItems = wrapper.findAll('.draggable-item').length;
        expect(newItems).toBe(initialItems + 1);
    });

    it('should undo an action when pressing Ctrl+Z', async () => {
        const wrapper = mount(App, {
            attachTo: document.body // Needed for window event listeners
        });

        // 1. Add an item
        const buttons = wrapper.findAll('button');
        const addButton = buttons.find(b => b.text() === 'Add Work Item');
        await addButton?.trigger('click');

        const countAfterAdd = wrapper.findAll('.draggable-item').length;

        // 2. Trigger Undo (Ctrl+Z) on window
        await wrapper.trigger('keydown', { key: 'z', ctrlKey: true });
        
        // 3. Count should decrease
        const countAfterUndo = wrapper.findAll('.draggable-item').length;
        expect(countAfterUndo).toBe(countAfterAdd - 1);
        
        wrapper.unmount();
    });
});
