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

function createTagButton(tag, selected, onToggle, maxSelectedTagCount, onSelectionLimitReached) {
  const button = createElement('button', 'tag-chip tag-picker-tag');
  const tagId = Number(tag.id);
  button.type = 'button';
  button.dataset.tagId = String(tagId);
  button.dataset.color = normalizeTagColor(tag.color);
  button.setAttribute('aria-pressed', String(selected.has(tagId)));
  button.textContent = tag.name;
  button.addEventListener('click', () => {
    const nextSelected = !selected.has(tagId);
    if (nextSelected && selected.size >= maxSelectedTagCount) {
      onSelectionLimitReached(maxSelectedTagCount);
      return;
    }
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

function openTagDialog({ tag = null, onSave, returnFocus }) {
  const isEditing = Boolean(tag);
  const instance = ++tagCreationDialogInstance;
  const layer = createElement('div', 'modal-layer tag-create-layer');
  const dialog = createElement('section', 'tag-create-dialog glass-panel');
  const title = createElement('h2', '', isEditing ? 'แก้ไขแท็ก' : 'สร้างแท็กวิชา');
  title.id = `tag-create-dialog-title-${instance}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.tabIndex = -1;

  const header = createElement('header', 'tag-create-dialog__header');
  const closeButton = createElement('button', 'icon-button icon-button--danger', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', isEditing ? 'ปิดหน้าต่างแก้ไขแท็ก' : 'ปิดหน้าต่างสร้างแท็ก');
  header.append(title, closeButton);

  const form = createElement('form', 'tag-create-dialog__form');
  const nameLabel = createElement('label', 'tag-create-dialog__label', 'ชื่อแท็กวิชา');
  const nameInput = createElement('input', 'tag-create-dialog__name');
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.setAttribute('aria-label', 'New topic tag name');
  nameInput.autocomplete = 'off';
  nameInput.value = tag?.name ?? '';
  nameLabel.append(nameInput);

  let selectedColor = normalizeTagColor(tag?.color ?? DEFAULT_TAG_COLOR);
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
  const createButton = createElement('button', 'button button-primary', isEditing ? 'บันทึก' : 'เพิ่มแท็กวิชา');
  createButton.type = 'submit';
  createButton.dataset.action = isEditing ? 'save-tag' : 'create-tag';
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
      status.textContent = 'กรุณากรอกชื่อแท็กวิชา';
      nameInput.focus();
      return;
    }

    busy = true;
    nameInput.removeAttribute('aria-invalid');
    status.textContent = isEditing ? 'กำลังบันทึกแท็ก…' : 'กำลังสร้างแท็ก…';
    createButton.disabled = true;
    cancelButton.disabled = true;
    closeButton.disabled = true;
    try {
      await onSave({ name, color: selectedColor });
      nameInput.value = '';
      close();
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : isEditing ? 'แก้ไขแท็กไม่สำเร็จ กรุณาลองอีกครั้ง' : 'สร้างแท็กไม่สำเร็จ กรุณาลองอีกครั้ง';
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

export function openTagCreationDialog({ onCreate, returnFocus }) {
  return openTagDialog({ onSave: onCreate, returnFocus });
}

export function openTagEditDialog({ tag, onSave, returnFocus }) {
  return openTagDialog({ tag, onSave, returnFocus });
}

export function openTagManagementDialog({
  catalog = { tags: [] },
  loadTags = async () => catalog,
  updateTag,
  deleteTag,
  confirmDelete = () => false,
  onCatalogChange = () => {},
  onMessage = () => {},
  returnFocus,
} = {}) {
  let currentCatalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
  let closed = false;
  const instance = ++tagCreationDialogInstance;
  const layer = createElement('div', 'modal-layer deadline-subject-management-layer');
  layer.dataset.role = 'tag-management-layer';
  const dialog = createElement('section', 'deadline-subject-management');
  dialog.dataset.role = 'tag-management-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `tag-management-title-${instance}`);
  dialog.tabIndex = -1;
  const header = createElement('header', 'tag-create-dialog__header deadline-subject-management__header');
  const title = createElement('h2', '', 'แก้ไขแท็ก');
  title.id = `tag-management-title-${instance}`;
  const closeButton = createElement('button', 'icon-button icon-button--danger', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'ปิดหน้าต่างแก้ไขแท็ก');
  header.append(title, closeButton);
  const hint = createElement('p', 'deadline-subject-management__hint', 'แก้ชื่อหรือสี และลบแท็กที่สร้างเอง');
  const list = createElement('div', 'deadline-subject-management__list');
  list.dataset.role = 'tag-management-list';
  list.dataset.visibleLimit = '10';
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'แท็กที่สร้างเอง');
  const footer = createElement('footer', 'deadline-subject-management__footer');
  footer.append(
    createElement('p', 'deadline-subject-management__note', 'ลบแท็กแล้วจะถอดป้ายออกจากรายการที่ใช้ แต่ข้อมูลเดิมยังอยู่'),
    createElement('button', 'button button-secondary', 'ปิด'),
  );
  const footerClose = footer.querySelector('button');
  footerClose.type = 'button';
  dialog.append(header, hint, list, footer);
  layer.append(dialog);

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    layer.remove();
    if (returnFocus?.isConnected) returnFocus.focus();
  }

  function onKeydown(event) {
    if (!dialog.contains(document.activeElement)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function refreshCatalog(fallbackTags, action, tag) {
    let nextCatalog = { tags: fallbackTags };
    let refreshed = false;
    try {
      const result = await loadTags();
      if (Array.isArray(result?.tags)) {
        nextCatalog = result;
        refreshed = true;
      }
    } catch {
      // Keep the successful mutation visible even if refreshing the catalog fails.
    }
    currentCatalog = nextCatalog;
    renderList();
    onCatalogChange(currentCatalog, { action, tag, refreshed });
    if (!refreshed) onMessage('บันทึกแท็กแล้ว แต่โหลดรายการแท็กล่าสุดไม่สำเร็จ', true);
  }

  function renderList() {
    list.replaceChildren();
    const customTags = currentCatalog.tags.filter((tag) => tag?.is_builtin === false);
    if (customTags.length === 0) {
      const empty = createElement('p', 'deadline-subject-management__empty', 'ยังไม่มีแท็กที่สร้างเอง');
      empty.setAttribute('role', 'status');
      list.append(empty);
      return;
    }

    for (const tag of customTags) {
      const tagId = Number(tag.id);
      const row = createElement('div', 'deadline-subject-management__row');
      row.setAttribute('role', 'listitem');
      row.dataset.tagId = String(tagId);
      const chip = createElement('span', 'tag-chip deadline-subject-management__chip');
      chip.dataset.color = tag.color || 'violet';
      const swatch = createElement('span', 'deadline-subject-management__swatch');
      swatch.dataset.color = tag.color || 'violet';
      swatch.setAttribute('aria-hidden', 'true');
      const label = createElement('span', 'deadline-subject-management__chip-label', tag.name);
      chip.append(swatch, label);
      const actions = createElement('div', 'deadline-subject-management__actions');
      const editButton = createElement('button', 'button button-secondary deadline-subject-management__button deadline-subject-management__button--edit', 'แก้ไข');
      editButton.type = 'button';
      editButton.dataset.action = 'edit-tag';
      editButton.dataset.tagId = String(tagId);
      editButton.setAttribute('aria-label', `แก้ไขแท็ก ${tag.name}`);
      editButton.addEventListener('click', () => openTagEditDialog({
        tag,
        returnFocus: dialog,
        onSave: async (payload) => {
          const saved = await updateTag(tagId, payload);
          const updatedTag = {
            ...tag,
            ...saved,
            id: tagId,
            name: typeof saved?.name === 'string' && saved.name.trim() ? saved.name.trim() : payload.name,
            color: saved?.color || payload.color,
          };
          const fallbackTags = currentCatalog.tags.map((current) => (
            Number(current.id) === tagId ? updatedTag : current
          ));
          await refreshCatalog(fallbackTags, 'update', updatedTag);
          onMessage(`แก้ไขแท็ก “${updatedTag.name}” แล้ว`);
        },
      }));

      const deleteButton = createElement('button', 'button button-danger deadline-subject-management__button deadline-subject-management__button--delete', 'ลบ');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete-tag';
      deleteButton.dataset.tagId = String(tagId);
      deleteButton.setAttribute('aria-label', `ลบแท็ก ${tag.name}`);
      deleteButton.addEventListener('click', async () => {
        const confirmed = await confirmDelete(
          `ยืนยันลบแท็ก “${tag.name}” หรือไม่? แท็กนี้จะถูกถอดออกจากรายการที่ใช้ทั้งหมด แต่จะไม่ลบเอกสาร ข้อสอบ บทสนทนา หรืองานกำหนดส่ง`,
        );
        if (!confirmed) return;
        deleteButton.disabled = true;
        try {
          await deleteTag(tagId);
          const fallbackTags = currentCatalog.tags.filter((current) => Number(current.id) !== tagId);
          await refreshCatalog(fallbackTags, 'delete', tag);
          onMessage(`ลบแท็ก “${tag.name}” แล้ว`);
          dialog.focus();
        } catch (error) {
          deleteButton.disabled = false;
          onMessage(error?.message || 'ลบแท็กไม่สำเร็จ กรุณาลองอีกครั้ง', true);
        }
      });
      actions.append(editButton, deleteButton);
      row.append(chip, actions);
      list.append(row);
    }
  }

  closeButton.addEventListener('click', close);
  footerClose.addEventListener('click', close);
  layer.addEventListener('click', (event) => {
    if (event.target === layer) close();
  });
  renderList();
  document.addEventListener('keydown', onKeydown);
  document.body.append(layer);
  closeButton.focus();
  return layer;
}

export function renderTagPicker({
  catalog,
  selectedTagIds = [],
  maxSelectedTagCount = Number.POSITIVE_INFINITY,
  onSelectionLimitReached = () => {},
  onToggle = () => {},
  onCreate = () => {},
  onManage,
} = {}) {
  catalog = catalog && Array.isArray(catalog.tags) ? catalog : { tags: [] };
  const selectionLimit = Number.isSafeInteger(maxSelectedTagCount) && maxSelectedTagCount >= 0
    ? maxSelectedTagCount
    : Number.POSITIVE_INFINITY;
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
      groups.append(createTagButton(tag, selected, onToggle, selectionLimit, onSelectionLimitReached));
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

  const actions = createElement('div', 'tag-picker-actions');
  const createButton = createElement('button', 'button button-primary tag-picker-create', '+ สร้างแท็กวิชา');
  createButton.type = 'button';
  createButton.dataset.action = 'open-tag-create';
  createButton.addEventListener('click', () => openTagCreationDialog({
    onCreate,
    returnFocus: createButton,
  }));

  actions.append(createButton);
  if (typeof onManage === 'function') {
    const manageButton = createElement('button', 'button button-secondary tag-picker-manage', 'แก้ไขแท็ก');
    manageButton.type = 'button';
    manageButton.dataset.action = 'open-tag-management';
    manageButton.setAttribute('aria-haspopup', 'dialog');
    manageButton.addEventListener('click', () => onManage(manageButton));
    actions.append(manageButton);
  }
  picker.append(search, groups, actions);
  return picker;
}
