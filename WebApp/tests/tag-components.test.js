// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  renderTagChips,
  renderTagColorPalette,
  renderTagFilter,
  renderTagPicker,
} from '../src/tags/tag-components.js';
import { TAG_COLOR_PALETTE } from '../src/tags/tag-colors.js';
import { nextDocumentTagSelection } from '../src/tags/document-tag-selection.js';

const catalog = {
  tags: [
    { id: 1, name: 'Mathematics', is_builtin: true, color: 'blue', parent_id: null },
    { id: 2, name: 'English', is_builtin: true, color: 'violet', parent_id: null },
    { id: 8, name: 'Sets', parent_id: 1, is_builtin: false, color: 'pink' },
    { id: 9, name: 'Algebra', parent_id: null, is_builtin: false, color: 'green' },
  ],
};

describe('reusable quiz tag controls', () => {
  it('renders selected tags as readable chips', () => {
    const chips = renderTagChips([
      { id: 1, name: 'Mathematics', parent_id: null, is_builtin: true, color: 'blue' },
      { id: 8, name: 'Sets', parent_id: 1, is_builtin: false, color: 'pink' },
    ]);

    expect(chips.textContent).toContain('Mathematics');
    expect(chips.textContent).toContain('Sets');
    expect(chips.querySelectorAll('[data-tag-id]')).toHaveLength(2);
  });

  it('test_tag_chips_render_persisted_palette_keys', () => {
    const chips = renderTagChips([
      { id: 1, name: 'Mathematics', color: 'blue' },
      { id: 8, name: 'Sets', color: 'not-a-color' },
    ]);

    expect(chips.querySelector('[data-tag-id="1"]').dataset.color).toBe('blue');
    expect(chips.querySelector('[data-tag-id="8"]').dataset.color).toBe('violet');
    expect(chips.querySelectorAll('button')).toHaveLength(0);
  });

  it('test_palette_has_ten_keyboard_accessible_choices', () => {
    const onChange = vi.fn();
    const palette = renderTagColorPalette({ selectedColor: 'blue', onChange });

    expect(TAG_COLOR_PALETTE).toHaveLength(10);
    expect(palette.querySelectorAll('input[type="radio"]')).toHaveLength(10);
    expect(palette.querySelector('input[value="blue"]')?.checked).toBe(true);
    expect(palette.querySelector('input[value="pink"]')?.labels?.[0].textContent).toContain('Pink');

    const pink = palette.querySelector('input[value="pink"]');
    pink.checked = true;
    pink.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('pink');
  });

  it('test_tag_chip_toggles_immediately_and_keeps_focus', () => {
    const onToggle = vi.fn();
    const picker = renderTagPicker({ catalog, selectedTagIds: [1], onToggle, onCreate: vi.fn() });
    const subject = picker.querySelector('button[data-tag-id="1"]');
    const topic = picker.querySelector('button[data-tag-id="8"]');

    expect(subject.getAttribute('aria-pressed')).toBe('true');
    expect(topic.getAttribute('aria-pressed')).toBe('false');
    expect(picker.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(Array.from(picker.querySelectorAll('button')).some((button) => button.textContent === 'Save tags'))
      .toBe(false);

    topic.click();
    subject.click();
    expect(onToggle.mock.calls).toEqual([[8, true], [1, false]]);
    expect(topic.getAttribute('aria-pressed')).toBe('true');
    expect(subject.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens one accessible tag creation dialog from the compact picker action', () => {
    const picker = renderTagPicker({ catalog, onCreate: vi.fn() });
    document.body.append(picker);
    const trigger = picker.querySelector('[data-action="open-tag-create"]');

    expect(picker.querySelectorAll('.tag-picker-create')).toHaveLength(1);
    expect(picker.querySelector('[data-action="open-tag-create"]')?.tagName).toBe('BUTTON');
    expect(trigger.textContent).toBe('สร้างแท็ก');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    trigger.focus();
    trigger.click();

    const dialog = document.querySelector('.tag-create-dialog');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.querySelector('h2')?.textContent).toBe('สร้างแท็กใหม่');
    expect(dialog?.querySelector('[aria-label="ปิดหน้าต่างสร้างแท็ก"]')?.textContent).toBe('×');
    expect(dialog?.querySelector('.tag-create-dialog__label')?.textContent).toContain('ชื่อแท็ก');
    expect(dialog?.querySelector('[data-action="cancel-tag-create"]')?.textContent).toBe('ยกเลิก');
    expect(dialog?.querySelector('[data-action="create-tag"]')?.textContent).toBe('เพิ่มแท็ก');
    expect(dialog?.querySelector('[aria-label="New topic tag name"]')).not.toBeNull();
    expect(dialog?.querySelectorAll('.tag-color-option')).toHaveLength(10);
    expect(document.activeElement).toBe(dialog?.querySelector('[aria-label="New topic tag name"]'));
    dialog.querySelector('[data-action="cancel-tag-create"]').click();
    expect(document.querySelector('.tag-create-dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab navigation inside the tag creation dialog', () => {
    const picker = renderTagPicker({ catalog, onCreate: vi.fn() });
    document.body.append(picker);
    picker.querySelector('[data-action="open-tag-create"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    const submit = dialog.querySelector('[data-action="create-tag"]');
    submit.focus();
    expect(document.activeElement).toBe(submit);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    expect(tab.key).toBe('Tab');
    expect(dialog.contains(document.activeElement)).toBe(true);

    submit.dispatchEvent(tab);

    expect(document.activeElement).toBe(dialog.querySelector('[aria-label="ปิดหน้าต่างสร้างแท็ก"]'));
    expect(tab.defaultPrevented).toBe(true);
    dialog.querySelector('[data-action="cancel-tag-create"]').click();
  });

  it('closes the tag creation dialog with Escape and restores focus to its trigger', () => {
    const picker = renderTagPicker({ catalog, onCreate: vi.fn() });
    document.body.append(picker);
    const trigger = picker.querySelector('[data-action="open-tag-create"]');
    trigger.focus();
    trigger.click();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('.tag-create-dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('flows tag choices into compact rows that wrap when space runs out', () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = readFileSync('src/styles.css', 'utf8');
    document.head.append(stylesheet);
    const picker = renderTagPicker({ catalog, onToggle: vi.fn(), onCreate: vi.fn() });
    document.body.append(picker);

    try {
      const choices = picker.querySelector('.tag-picker-groups');
      const layout = getComputedStyle(choices);

      expect(layout.display).toBe('flex');
      expect(layout.flexWrap).toBe('wrap');
      expect(choices.querySelectorAll('.tag-picker-tag')).toHaveLength(4);
    } finally {
      stylesheet.remove();
      picker.remove();
    }
  });

  it('keeps keyboard focus on the selected tag button after a toggle', () => {
    let picker;
    picker = renderTagPicker({
      catalog,
      selectedTagIds: [],
      onToggle: (tagId, selected) => picker.setSelectedTagIds(selected ? [tagId] : []),
      onCreate: vi.fn(),
    });
    document.body.append(picker);
    const topic = picker.querySelector('button[data-tag-id="8"]');

    topic.focus();
    topic.click();

    expect(document.activeElement).toBe(topic);
    expect(topic.getAttribute('aria-pressed')).toBe('true');
  });

  it('updates an open picker and tag creation dialog without losing form state', () => {
    const picker = renderTagPicker({ catalog: { tags: [] }, onCreate: vi.fn() });
    document.body.append(picker);
    const search = picker.querySelector('[aria-label="Search tags"]');
    search.value = 'sets';
    picker.querySelector('[data-action="open-tag-create"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    const nameInput = dialog.querySelector('[aria-label="New topic tag name"]');
    nameInput.value = 'Draft topic';

    picker.setCatalog(catalog);
    picker.setSelectedTagIds([8]);
    picker.setCatalog({ tags: [...catalog.tags, {
      id: 10, name: 'Sets extension', parent_id: null, is_builtin: false, color: 'rose',
    }] });

    expect(search.value).toBe('sets');
    expect(nameInput.value).toBe('Draft topic');
    expect(picker.querySelector('button[data-tag-id="8"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(picker.querySelector('button[data-tag-id="10"]')?.textContent).toBe('Sets extension');
    expect(picker.querySelector('button[data-tag-id="8"]')).toBeTruthy();
    expect(picker.querySelector('button[data-tag-id="1"]')).toBeNull();
    expect(document.querySelector('.tag-create-dialog [aria-label="New topic tag name"]').value).toBe('Draft topic');
    dialog.querySelector('[data-action="cancel-tag-create"]').click();
  });

  it('test_tag_picker_searches_flat_catalog', () => {
    const picker = renderTagPicker({ catalog, selectedTagIds: [], onToggle: vi.fn(), onCreate: vi.fn() });
    const search = picker.querySelector('[aria-label="Search tags"]');

    search.value = 'sets';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(picker.querySelector('button[data-tag-id="8"]').hidden).toBe(false);
    expect(picker.querySelector('button[data-tag-id="1"]')).toBeNull();
    expect(picker.querySelector('button[data-tag-id="2"]')).toBeNull();
  });

  it('creates a custom tag from the dialog without assigning a parent', async () => {
    const onCreate = vi.fn();
    const picker = renderTagPicker({ catalog, selectedTagIds: [], onToggle: vi.fn(), onCreate });
    document.body.append(picker);
    picker.querySelector('[data-action="open-tag-create"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    const nameInput = dialog.querySelector('[aria-label="New topic tag name"]');
    const pink = dialog.querySelector('.tag-color-palette input[value="pink"]');

    nameInput.value = ' Algebra ';
    pink.checked = true;
    pink.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.querySelector('[data-action="create-tag"]').click();
    await Promise.resolve();

    expect(onCreate).toHaveBeenCalledWith({ name: 'Algebra', color: 'pink' });
    expect(document.querySelector('.tag-create-dialog')).toBeNull();
  });

  it('keeps tag creation as one prominent action inside the picker', () => {
    const picker = renderTagPicker({ catalog, onToggle: vi.fn(), onCreate: vi.fn() });
    const action = picker.querySelector('.tag-picker-create');

    expect(action?.tagName).toBe('BUTTON');
    expect(action?.classList.contains('button')).toBe(true);
    expect(action?.classList.contains('button-primary')).toBe(true);
  });

  it('keeps the tag creation dialog open and reports a create error for retry', async () => {
    const picker = renderTagPicker({
      catalog,
      onCreate: vi.fn().mockRejectedValue(new Error('ชื่อนี้มีอยู่แล้ว')),
    });
    document.body.append(picker);
    picker.querySelector('[data-action="open-tag-create"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    dialog.querySelector('[aria-label="New topic tag name"]').value = 'Algebra';
    dialog.querySelector('[data-action="create-tag"]').click();
    await Promise.resolve();

    expect(dialog.querySelector('[role="status"]').textContent).toBe('ชื่อนี้มีอยู่แล้ว');
    expect(document.querySelector('.tag-create-dialog')).toBe(dialog);
    dialog.querySelector('[data-action="cancel-tag-create"]').click();
  });

  it('requires a name before the tag dialog can submit', async () => {
    const onCreate = vi.fn();
    const picker = renderTagPicker({ catalog, onCreate });
    document.body.append(picker);
    picker.querySelector('[data-action="open-tag-create"]').click();
    const dialog = document.querySelector('.tag-create-dialog');
    dialog.querySelector('[data-action="create-tag"]').click();
    await Promise.resolve();

    expect(onCreate).not.toHaveBeenCalled();
    expect(dialog.querySelector('[role="status"]').textContent).toBe('กรุณากรอกชื่อแท็ก');
    expect(document.querySelector('.tag-create-dialog')).toBe(dialog);
    dialog.querySelector('[data-action="cancel-tag-create"]').click();
  });

  it('offers all flat tags in an accessible filter and reports selected IDs', () => {
    const onChange = vi.fn();
    const filter = renderTagFilter(catalog, null, onChange);

    expect(filter.getAttribute('aria-label')).toBe('กรองตามวิชาและแท็ก');
    expect(filter.options[0].textContent).toBe('ทุกวิชาและแท็ก');
    expect(Array.from(filter.options, (option) => option.value)).toEqual(['', '1', '2', '8', '9']);
    expect(Array.from(filter.options, (option) => option.textContent).join(' ')).toContain('Sets');

    filter.value = '8';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('test_tag_picker_appends_custom_tags_after_builtins', () => {
    const onCreate = vi.fn();
    const picker = renderTagPicker({
      catalog,
      selectedTagIds: [],
      onToggle: vi.fn(),
      onCreate,
    });

    const ids = Array.from(picker.querySelectorAll('button[data-tag-id]'), (button) => button.dataset.tagId);
    expect(ids).toEqual(['1', '2', '8', '9']);
    expect(picker.querySelector('[aria-label="Subject for new tag"]')).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('test_tag_selection_allows_unrelated_tags', () => {
    expect(nextDocumentTagSelection([1, 8], 9, catalog)).toEqual([1, 8, 9]);
    expect(nextDocumentTagSelection([1, 8, 9], 1, catalog)).toEqual([8, 9]);
  });

  it('uses high-contrast theme ink for unselected tags in the light theme', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toMatch(/\[data-theme="light"\]\s+\.tag-chip:not\(\[aria-pressed="true"\]\)\s*\{[^}]*color:\s*var\(--ink\)/s);
  });
});
