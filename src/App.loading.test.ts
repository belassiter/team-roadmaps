// src/App.loading.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App.vue Loading', () => {

    it('should load a project from JSON file', async () => {
        const wrapper = mount(App);

        // Prepare File Mock
        const mockData = {
            version: 1,
            timestamp: "2023-10-27T10:00:00.000Z",
            gridConfig: { cols: 45, rows: 10 },
            axisConfig: { mode: "day", startDate: "2023-01-01", weekdaysOnly: true },
            items: [
                { id: 99, x: 100, y: 100, widthUnits: 4, name: "Loaded Item", color: "#ff0000" }
            ]
        };
        const fileContent = JSON.stringify(mockData);
        const file = new File([fileContent], 'project.json', { type: 'application/json' });

        // Mock FileReader
        const readAsTextMock = vi.fn();
        const mockFileReader = {
            readAsText: readAsTextMock,
            onload: null as any,
            result: null as any,
        };
        
        // Hijack global FileReader
        const originalFileReader = global.FileReader;
        // Function declaration to allow constructor usage
        const MockFileReader = vi.fn(function() { return mockFileReader; });
        global.FileReader = MockFileReader as any;

        // Find Input
        // Note: The input is hidden in the template, usually `input[type="file"]` or ref="fileInput"
        // Let's assume there is a way to trigger it. 
        // Based on read_file, there is a `loadProject` method triggered by input change.
        const input = wrapper.find('input[type="file"]');
        expect(input.exists()).toBe(true);

        // Simulate File Selection
        Object.defineProperty(input.element, 'files', {
            value: [file],
            writable: false,
        });
        await input.trigger('change');

        // Verify FileReader was called
        expect(readAsTextMock).toHaveBeenCalledWith(file);

        // Trigger onload manually since mock doesn't do it
        mockFileReader.result = fileContent;
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: fileContent } } as any);
        }

        // Wait for Vue reactivity
        await wrapper.vm.$nextTick();

        // Assert State Updates
        // 1. Grid Config
        // We can check vm state directly if we want
        expect((wrapper.vm as any).gridConfig.cols).toBe(45);
        expect((wrapper.vm as any).gridConfig.rows).toBe(10);

        // 2. Items
        expect((wrapper.vm as any).items.length).toBe(1);
        expect((wrapper.vm as any).items[0].name).toBe("Loaded Item");
        
        // 3. Selection should be cleared
        expect((wrapper.vm as any).selectedItemIds.size).toBe(0);

        // Cleanup
        global.FileReader = originalFileReader;
    });

    it('should handle invalid JSON gracefully', async () => {
        const wrapper = mount(App);
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

        const file = new File(['INVALID JSON'], 'bad.json', { type: 'application/json' });
        
         // Mock FileReader
         const mockFileReader = {
            readAsText: vi.fn(),
            onload: null as any,
            result: null as any,
        };
        const originalFileReader = global.FileReader;
        // Function declaration
        const MockFileReader = vi.fn(function() { return mockFileReader; });
        global.FileReader = MockFileReader as any;

        const input = wrapper.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', { value: [file] });
        await input.trigger('change');

        mockFileReader.result = 'INVALID JSON';
        if (mockFileReader.onload) {
            mockFileReader.onload({ target: { result: 'INVALID JSON' } } as any);
        }

        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Error loading file'));

        alertMock.mockRestore();
        global.FileReader = originalFileReader;
    });
});
