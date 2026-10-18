import {
  DEFAULT_TAG_COLOR,
  TAG_COLOR_PALETTE,
  normalizeTagColor,
} from './tag-colors.js';

let paletteInstance = 0;
let tagCreationDialogInstance = 0;

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function tagOptions(catalog) {
  return Array.isArray(catalog?.tags) ? catalog.tags : [];
}

function createTagButton(tag, selected, onToggle) {
  const button = createElement('button', 'tag-chip tag-picker-tag');
  const tagId = Number(tag.id);
  button.type = 'button';
  button.dataset.tagId = String(tagId);
  button.dataset.color = normalizeTagColor(tag.color);
  button.setAttribute('aria-pressed', String(selected.has(tagId)));
  button.textContent = tag.name;
  button.addEventListener('click', () => {
    const nextSelected = !selected.has(tagId);
    if (nextSelected) selected.add(tagId);
    else selected.delete(tagId);
    button.setAttribute('aria-pressed', String(nextSelected));
    onToggle(tagId, nextSelected);
  });
  return button;
}

export function renderTagChips(tags = []) {
  const container = createElement('div', 'tag-chip-list');
  container.setAttribute('aria-label', 'Quiz tags');
  for (const tag of tags) {
    const chip = createElement('span', 'tag-chip');
    chip.dataset.tagId = String(tag.id);
    chip.dataset.color = normalizeTagColor(tag.color);
    chip.textContent = tag.name;
    container.append(chip);
  }
  return container;
}

export function renderTagFilter(catalog, selectedTagId, onChange = () => {}) {
  const select = createElement('select', 'tag-filter themed-select');
  select.setAttribute('aria-label', 'กรองตามวิชาและแท็ก');
  const allOption = createElement('option');
  allOption.value = '';
  allOption.textContent = 'ทุกวิชาและแท็ก';
  select.append(allOption);

  for (const tag of tagOptions(catalog)) {
    const option = createElement('option');
    option.value = String(tag.id);
    option.textContent = tag.name;
    select.append(option);
  }

  select.value = selectedTagId === null || selectedTagId === undefined ? '' : String(selectedTagId);
  select.addEventListener('change', () => {
    onChange(select.value === '' ? null : Number(select.value));
  });
  return select;
}

export function renderTagColorPalette({ selectedColor = DEFAULT_TAG_COLOR, onChange = () => {} } = {}) {
  const fieldset = createElement('fieldset', 'tag-color-palette');
  const legend = createElement('legend');
  const radioGroupName = `tag-color-${++paletteInstance}`;
  legend.textContent = 'Tag color';
  fieldset.append(legend);

  for (const { key, label: colorLabel } of TAG_COLOR_PALETTE) {
    const label = createElement('label', 'tag-color-option');
    const input = createElement('input');
    input.type = 'radio';
    input.name = radioGroupName;
    input.value = key;
    input.checked = normalizeTagColor(selectedColor) === key;
    input.setAttribute('aria-label', colorLabel);

    const swatch = createElement('span', 'tag-color-swatch');
    swatch.dataset.color = key;
    swatch.setAttribute('aria-hidden', 'true');

    const text = createElement('span', 'tag-color-option-label');
    text.textContent = colorLabel;
    label.append(input, swatch, text);
    input.addEventListener('change', () => {
      if (input.checked) onChange(key);
    });
    fieldset.append(label);
  }

  return fieldset;
}

function openTagCreationDialog({ onCreate, returnFocus }) {
  const instance = ++tagCreationDialogInstance;
  const layer = createElement('div', 'modal-layer tag-create-layer');
  const dialog = createElement('section', 'tag-create-dialog glass-panel');
  const title = createElement('h2', '', 'สร้างแท็กใหม่');
  title.id = `tag-create-dialog-title-${instance}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.tabIndex = -1;

  const header = createElement('header', 'tag-create-dialog__header');
  const closeButton = createElement('button', 'icon-button', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'ปิดหน้าต่างสร้างแท็ก');
  header.append(title, closeButton);

  const form = createElement('form', 'tag-create-dialog__form');
  const nameLabel = createElement('label', 'tag-create-dialog__label', 'ชื่อแท็ก');
  const nameInput = createElement('input', 'tag-create-dialog__name');
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.setAttribute('aria-label', 'New topic tag name');
  nameInput.autocomplete = 'off';
  nameLabel.append(nameInput);

  let selectedColor = DEFAULT_TAG_COLOR;
  const palette = renderTagColorPalette({
    selectedColor,
    onChange: (color) => {
      selectedColor = color;
    },
  });

  const status = createElement('p', 'tag-create-dialog__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const actions = createElement('footer', 'tag-create-dialog__actions');
  const cancelButton = createElement('button', 'button button-secondary', 'ยกเลิก');
  cancelButton.type = 'button';
  cancelButton.dataset.action = 'cancel-tag-create';
  const createButton = createElement('button', 'button button-primary', 'เพิ่มแท็ก');
  createButton.type = 'submit';
  createButton.dataset.action = 'create-tag';
  actions.append(cancelButton, createButton);
  form.append(nameLabel, palette, status, actions);
  dialog.append(header, form);
  layer.append(dialog);

  let busy = false;
  let closed = false;
  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    layer.remove();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
      .sort((first, second) => {
        if (first === second) return 0;
        return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown);
  layer.addEventListener('click', (event) => {
    if (event.target === layer && !busy) close();
  });
  closeButton.addEventListener('click', () => close());
  cancelButton.addEventListener('click', () => close());
  nameInput.addEventListener('input', () => {
    nameInput.removeAttribute('aria-invalid');
    status.textContent = '';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.setAttribute('aria-invalid', 'true');
      status.textContent = 'กรุณากรอกชื่อแท็ก';
      nameInput.focus();
      return;
    }

    busy = true;
    nameInput.removeAttribute('aria-invalid');
    status.textContent = 'กำลังสร้างแท็ก…';
    createButton.disabled = true;
    cancelButton.disabled = true;
    closeButton.disabled = true;
    try {
      await onCreate({ name, color: selectedColor });
      nameInput.value = '';
      close();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'สร้างแท็กไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      busy = false;
      if (!closed) {
        createButton.disabled = false;
        cancelButton.disabled = false;
        closeButton.disabled = false;
      }
    }
  });

  document.body.append(layer);
  nameInput.focus();
}

export function renderTagPicker({
  catalog,
  selectedTagIds = [],
  onToggle = () => {},
  onCreate = () => {},
} = {}) {
  catalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
  const picker = createElement('div', 'tag-picker');
  const selected = new Set(selectedTagIds.map(Number));
  const search = createElement('input', 'tag-picker-search');
  search.type = 'search';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search tags');
  search.placeholder = 'Search subjects or tags';

  const groups = createElement('div', 'tag-picker-groups');
  const renderGroups = () => {
    const query = search.value.trim().toLocaleLowerCase();
    const focusedTagId = groups.contains(document.activeElement)
      ? document.activeElement.closest('button[data-tag-id]')?.dataset.tagId
      : null;
    groups.replaceChildren();

    for (const tag of tagOptions(catalog)) {
      if (query && !tag.name.toLocaleLowerCase().includes(query)) continue;
      groups.append(createTagButton(tag, selected, onToggle));
    }

    if (focusedTagId) {
      groups.querySelector(`button[data-tag-id="${focusedTagId}"]`)?.focus();
    }
  };
  search.addEventListener('input', renderGroups);
  renderGroups();
  picker.setSelectedTagIds = (tagIds) => {
    selected.clear();
    for (const id of tagIds ?? []) {
      const numericId = Number(id);
      if (Number.isInteger(numericId) && numericId > 0) selected.add(numericId);
    }
    for (const button of groups.querySelectorAll('button[data-tag-id]')) {
      button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.tagId))));
    }
  };

  picker.setCatalog = (nextCatalog) => {
    catalog = nextCatalog && Array.isArray(nextCatalog.tags) ? nextCatalog : { tags: [] };
    renderGroups();
  };

  const createButton = createElement('button', 'button button-primary tag-picker-create', 'สร้างแท็ก');
  createButton.type = 'button';
  createButton.dataset.action = 'open-tag-create';
  createButton.addEventListener('click', () => openTagCreationDialog({
    onCreate,
    returnFocus: createButton,
  }));

  picker.append(search, groups, createButton);
  return picker;
}
