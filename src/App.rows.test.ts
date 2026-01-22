// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

// Mock scrollTo since it's not in JSDOM
// Note: In JSDOM, Element might exist. Securely mock it.
if (typeof Element !== 'undefined') {
    Element.prototype.scrollTo = vi.fn();
}

describe('App.vue Row Naming', () => {
    let wrapper: any;

    beforeEach(() => {
        wrapper = mount(App);
    });

    it('should render default row numbers', () => {
        const rowHeaders = wrapper.findAll('.row-label-cell');
        console.log('Row Headers found:', rowHeaders.length);
        expect(rowHeaders.length).toBeGreaterThan(0);
        expect(rowHeaders[0].text()).toBe('1');
        expect(rowHeaders[1].text()).toBe('2');
    });

    it('should allow renaming a row', async () => {
        const rowHeader = wrapper.find('.row-label-cell');
        
        // Click to edit
        await rowHeader.trigger('click');
        expect(rowHeader.classes()).toContain('editing');

        const input = rowHeader.find('input');
        expect(input.exists()).toBe(true);

        // Type new name
        await input.setValue('Engineering');
        await input.trigger('blur');

        // Verify edit mode closed and text updated
        expect(rowHeader.classes()).not.toContain('editing');
        expect(rowHeader.text()).toContain('Engineering');
    });

    it('should persist row names in save object', async () => {
        // Rename row 0
        const rowHeader = wrapper.find('.row-label-cell');
        await rowHeader.trigger('click');
        const input = rowHeader.find('input');
        await input.setValue('Design');
        await input.trigger('blur');

        // Mock anchor element creation
        // We need a real node for appendChild to work, so we stub calls after creation?
        // Or we mock appendChild. Mocking appendChild is safer for avoiding DOM pollution.
        const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
        const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));
        
        // Mock URL
        global.URL.createObjectURL = vi.fn(() => 'blob:url');
        global.URL.revokeObjectURL = vi.fn();

        // Click Save
        const saveBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Save');
        await saveBtn.trigger('click');

        // Check internal state
        expect(wrapper.vm.gridConfig.rowDefinitions['0']).toBe('Design');
        
        // Restore
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
    });
});
