import {
  createDeadline as createDeadlineRequest,
  deleteDeadline as deleteDeadlineRequest,
  listTags as listTagsRequest,
  listDeadlines as listDeadlinesRequest,
  updateDeadline as updateDeadlineRequest,
} from '../api/client.js';

const PRIORITIES = [
  { id: 'high', label: 'ด่วน' },
  { id: 'medium', label: 'ปานกลาง' },
  { id: 'low', label: 'ไม่ด่วน' },
];
const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'incomplete', label: 'ยังไม่เสร็จ' },
  { id: 'completed', label: 'เสร็จแล้ว' },
];
const TASK_STATUSES = [
  { id: 'not_started', label: 'ยังไม่เริ่ม' },
  { id: 'in_progress', label: 'กำลังทำ' },
  { id: 'completed', label: 'เสร็จแล้ว' },
];
const TASKS_PER_PAGE = 10;

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันส่ง'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'ไม่ระบุวันและเวลา'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function sortByCreatedAt(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDate = new Date(left.created_at).getTime();
    const rightDate = new Date(right.created_at).getTime();
    const leftHasDate = Number.isFinite(leftDate);
    const rightHasDate = Number.isFinite(rightDate);
    if (leftHasDate && rightHasDate && leftDate !== rightDate) return rightDate - leftDate;
    if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;
    return Number(right.id) - Number(left.id);
  });
}

function priorityLabel(priority) {
  return PRIORITIES.find((option) => option.id === priority)?.label || 'ปานกลาง';
}

function taskStatus(task) {
  return TASK_STATUSES.some((item) => item.id === task.status)
    ? task.status
    : task.is_completed ? 'completed' : 'not_started';
}

function statusLabel(status) {
  return TASK_STATUSES.find((item) => item.id === status)?.label || 'ยังไม่เริ่ม';
}

function makeTaskCard(task, { onToggle, onStatusChange, onDelete, pending }) {
  const currentStatus = taskStatus(task);
  const completed = currentStatus === 'completed';
  const card = element('article', `deadline-task${completed ? ' is-completed' : ''}`);
  card.dataset.taskId = String(task.id);

  const heading = element('h3', 'deadline-task__title', task.title || 'งานไม่มีชื่อ');
  heading.dataset.role = 'deadline-title';

  const badges = element('div', 'deadline-task__badges');
  const subject = element('span', 'deadline-badge deadline-badge--subject', task.subject || 'อื่นๆ');
  subject.dataset.role = 'deadline-subject';
  const priority = element('span', `deadline-badge deadline-badge--${task.priority || 'medium'}`, priorityLabel(task.priority));
  priority.dataset.role = 'deadline-priority';
  const status = element(
    'span',
    `deadline-badge deadline-badge--status${completed ? ' is-completed' : ''}`,
    statusLabel(currentStatus),
  );
  status.dataset.role = 'deadline-status';
  badges.append(subject, priority, status);

  const dueAt = element('time', 'deadline-task__due', formatDateTime(task.due_at));
  dueAt.dataset.role = 'deadline-due-at';
  const parsedDueAt = new Date(task.due_at);
  if (!Number.isNaN(parsedDueAt.getTime())) dueAt.dateTime = parsedDueAt.toISOString();

  const actions = element('div', 'deadline-task__actions');
  const toggle = element(
    'button',
    'button button-secondary',
    completed ? 'ทำต่อ' : 'ทำเครื่องหมายว่าเสร็จ',
  );
  toggle.type = 'button';
  toggle.dataset.action = 'toggle-completion';
  toggle.setAttribute('aria-pressed', String(completed));
  toggle.setAttribute('aria-label', `${completed ? 'ทำต่อ' : 'ทำเครื่องหมายว่าเสร็จ'}: ${task.title}`);
  toggle.disabled = pending;
  toggle.addEventListener('click', () => onToggle(task));

  const statusSelect = element('select', 'deadline-task__status-select themed-select');
  statusSelect.dataset.action = 'change-status';
  statusSelect.setAttribute('aria-label', `สถานะงาน: ${task.title}`);
  statusSelect.disabled = pending;
  for (const optionData of TASK_STATUSES) {
    const option = element('option', '', optionData.label);
    option.value = optionData.id;
    option.selected = optionData.id === currentStatus;
    statusSelect.append(option);
  }
  statusSelect.addEventListener('change', () => onStatusChange(task, statusSelect.value));

  const remove = element('button', 'button button-quiet deadline-task__delete', 'ลบ');
  remove.type = 'button';
  remove.dataset.action = 'delete-deadline';
  remove.setAttribute('aria-label', `ลบงาน ${task.title}`);
  remove.disabled = pending;
  remove.addEventListener('click', () => onDelete(task));
  actions.append(statusSelect, toggle, remove);

  card.append(heading, badges, dueAt, actions);
  return card;
}

export function renderDeadlinesPage({
  loadDeadlines = listDeadlinesRequest,
  loadTags = listTagsRequest,
  createDeadline = createDeadlineRequest,
  updateDeadline = updateDeadlineRequest,
  deleteDeadline = deleteDeadlineRequest,
  onDeadlineCreated = () => {},
  confirmDelete = (message) => window.confirm(message),
  now = () => new Date(),
} = {}) {
  const page = element('section', 'deadline-page page-shell');
  const intro = element('header', 'deadline-page__intro');
  intro.append(
    element('p', 'eyebrow', 'YOUR STUDY PLANNER'),
    element('h1', '', 'กำหนดส่งงาน'),
    element('p', 'page-intro', 'วางแผนงานที่ต้องส่ง ติดตามความคืบหน้า และเริ่มจากกำหนดส่งที่ใกล้ที่สุด'),
  );

  const layout = element('div', 'deadline-layout');
  const createPanel = element('section', 'deadline-panel deadline-create-panel');
  createPanel.append(
    element('p', 'deadline-panel__eyebrow', 'PLAN YOUR WORK'),
    element('h2', '', 'เพิ่มงานใหม่'),
  );
  const form = element('form', 'deadline-form');
  form.dataset.role = 'deadline-form';

  const titleLabel = element('label', 'deadline-field__label', 'ชื่องาน');
  titleLabel.htmlFor = 'deadline-title';
  const titleInput = element('input', 'deadline-field__control');
  titleInput.id = 'deadline-title';
  titleInput.type = 'text';
  titleInput.maxLength = 160;
  titleInput.required = true;
  titleInput.placeholder = 'เช่น อ่านบทที่ 3';
  titleInput.dataset.role = 'title-input';
  titleLabel.append(titleInput);

  const subjectLabel = element('label', 'deadline-field__label', 'วิชา');
  subjectLabel.htmlFor = 'deadline-subject';
  const subjectSelect = element('select', 'deadline-field__control themed-select');
  subjectSelect.id = 'deadline-subject';
  subjectSelect.required = true;
  subjectSelect.dataset.role = 'subject-select';
  const subjectPlaceholder = element('option', '', 'เลือกวิชา');
  subjectPlaceholder.value = '';
  subjectPlaceholder.disabled = true;
  subjectPlaceholder.selected = true;
  subjectSelect.append(subjectPlaceholder);
  subjectSelect.disabled = true;
  const subjectStatus = element('span', 'deadline-field__hint', 'กำลังโหลดรายวิชา…');
  subjectStatus.dataset.role = 'subject-status';
  subjectStatus.setAttribute('role', 'status');
  subjectStatus.setAttribute('aria-live', 'polite');
  subjectLabel.append(subjectSelect);
  subjectLabel.append(subjectStatus);

  const dateLabel = element('label', 'deadline-field__label', 'วันส่ง');
  dateLabel.htmlFor = 'deadline-date';
  const dateInput = element('input', 'deadline-field__control');
  dateInput.id = 'deadline-date';
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.dataset.role = 'due-date-input';
  dateLabel.append(dateInput);

  const timeLabel = element('label', 'deadline-field__label', 'เวลาส่ง');
  timeLabel.htmlFor = 'deadline-time';
  const timeInput = element('input', 'deadline-field__control');
  timeInput.id = 'deadline-time';
  timeInput.type = 'time';
  timeInput.required = true;
  timeInput.dataset.role = 'due-time-input';
  timeLabel.append(timeInput);

  const priorityLabelNode = element('label', 'deadline-field__label', 'ระดับความเร่งด่วน');
  priorityLabelNode.htmlFor = 'deadline-priority';
  const prioritySelect = element('select', 'deadline-field__control themed-select');
  prioritySelect.id = 'deadline-priority';
  prioritySelect.required = true;
  prioritySelect.dataset.role = 'priority-select';
  const priorityPlaceholder = element('option', '', 'เลือกระดับความเร่งด่วน');
  priorityPlaceholder.value = '';
  priorityPlaceholder.disabled = true;
  priorityPlaceholder.selected = true;
  prioritySelect.append(priorityPlaceholder);
  for (const priority of PRIORITIES) {
    const option = element('option', '', priority.label);
    option.value = priority.id;
    prioritySelect.append(option);
  }
  priorityLabelNode.append(prioritySelect);

  const dateTimeFields = element('div', 'deadline-form__date-time');
  dateTimeFields.append(dateLabel, timeLabel);
  const message = element('p', 'deadline-message');
  message.dataset.role = 'deadline-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const submitButton = element('button', 'button button-primary deadline-form__submit', 'บันทึกงาน');
  submitButton.type = 'submit';
  submitButton.dataset.action = 'save-deadline';
  form.append(titleLabel, subjectLabel, dateTimeFields, priorityLabelNode, submitButton);
  createPanel.append(form);

  const taskColumn = element('div', 'deadline-task-column');
  const weekPanel = element('section', 'deadline-panel deadline-week-panel');
  weekPanel.setAttribute('aria-label', 'ภาพรวมงานในสัปดาห์นี้');
  const weekHeading = element('div', 'deadline-panel__heading');
  weekHeading.append(
    element('div', '', 'WEEK AT A GLANCE'),
    element('h2', '', 'สัปดาห์นี้'),
  );
  const weekGrid = element('div', 'deadline-week-grid');
  weekGrid.dataset.role = 'week-grid';
  weekPanel.append(weekHeading, weekGrid);

  const listPanel = element('section', 'deadline-panel deadline-list-panel');
  const listHeading = element('div', 'deadline-panel__heading');
  listHeading.append(
    element('div', '', 'YOUR TASKS'),
    element('h2', '', 'รายการงาน'),
  );
  const filterGroup = element('div', 'deadline-filters');
  filterGroup.setAttribute('role', 'group');
  filterGroup.setAttribute('aria-label', 'กรองรายการงาน');
  const taskList = element('div', 'deadline-task-list');
  taskList.dataset.role = 'deadline-list';
  const pagination = element('nav', 'deadline-pagination');
  pagination.dataset.role = 'deadline-pagination';
  pagination.setAttribute('aria-label', 'แบ่งหน้ารายการงาน');
  listPanel.append(listHeading, filterGroup, taskList);
  taskColumn.append(weekPanel, listPanel);
  layout.append(createPanel, taskColumn);
  page.append(intro, message, layout);

  let tasks = [];
  let currentFilter = 'all';
  let currentPage = 1;
  let loading = true;
  let loadFailed = false;
  let creating = false;
  const pendingIds = new Set();
  const availableSubjects = new Set();

  async function refreshSubjectTags() {
    subjectSelect.disabled = true;
    subjectStatus.textContent = 'กำลังโหลดรายวิชา…';
    try {
      const catalog = await loadTags();
      const subjects = Array.isArray(catalog?.tags)
        ? catalog.tags.filter((subject) => subject
          && Number.isSafeInteger(Number(subject.id))
          && Number(subject.id) > 0
          && typeof subject.name === 'string'
          && subject.name.trim())
        : [];
      availableSubjects.clear();
      subjectSelect.replaceChildren(subjectPlaceholder);
      for (const subject of subjects) {
        const id = Number(subject.id);
        const name = subject.name.trim();
        if (availableSubjects.has(id)) continue;
        availableSubjects.add(id);
        const option = element('option', '', name);
        option.value = String(id);
        subjectSelect.append(option);
      }
      subjectSelect.disabled = availableSubjects.size === 0;
      subjectStatus.textContent = availableSubjects.size > 0
        ? ''
        : 'ไม่พบแท็กวิชา';
    } catch {
      availableSubjects.clear();
      subjectSelect.replaceChildren(subjectPlaceholder);
      subjectStatus.textContent = 'โหลดรายวิชาไม่สำเร็จ กรุณาลองใหม่';
    }
  }

  function setMessage(text = '', isError = false) {
    message.textContent = text;
    message.dataset.state = isError ? 'error' : 'info';
  }

  function getVisibleTasks() {
    const sorted = sortByCreatedAt(tasks);
    if (currentFilter === 'incomplete') return sorted.filter((task) => taskStatus(task) !== 'completed');
    if (currentFilter === 'completed') return sorted.filter((task) => taskStatus(task) === 'completed');
    return sorted;
  }

  function renderPagination(totalCount) {
    const pageCount = Math.ceil(totalCount / TASKS_PER_PAGE);
    if (pageCount < 2) {
      pagination.replaceChildren();
      pagination.remove();
      return;
    }

    currentPage = Math.min(currentPage, pageCount);
    const previous = element('button', 'button button-secondary', 'ก่อนหน้า');
    previous.type = 'button';
    previous.dataset.action = 'previous-page';
    previous.disabled = currentPage === 1;
    previous.addEventListener('click', () => {
      currentPage -= 1;
      renderTasks();
    });

    const status = element('span', 'deadline-pagination__status', `หน้า ${currentPage} จาก ${pageCount}`);
    status.setAttribute('aria-live', 'polite');

    const next = element('button', 'button button-secondary', 'ถัดไป');
    next.type = 'button';
    next.dataset.action = 'next-page';
    next.disabled = currentPage === pageCount;
    next.addEventListener('click', () => {
      currentPage += 1;
      renderTasks();
    });

    pagination.replaceChildren(previous, status, next);
    listPanel.append(pagination);
  }

  function clearPagination() {
    pagination.replaceChildren();
    pagination.remove();
  }

  function renderEmptyState(text, canRetry = false) {
    const empty = element('div', 'deadline-empty-state');
    empty.dataset.role = 'deadline-empty-state';
    empty.append(element('p', 'deadline-empty-state__icon', '✦'), element('h3', '', text));
    if (canRetry) {
      const retry = element('button', 'button button-secondary', 'ลองโหลดอีกครั้ง');
      retry.type = 'button';
      retry.dataset.action = 'retry-load';
      retry.addEventListener('click', () => void refreshTasks());
      empty.append(retry);
    }
    taskList.replaceChildren(empty);
  }

  function renderTasks() {
    if (loading) {
      taskList.replaceChildren(element('p', 'deadline-loading', 'กำลังโหลดรายการงาน…'));
      clearPagination();
      return;
    }
    if (loadFailed && tasks.length === 0) {
      renderEmptyState('โหลดรายการงานไม่สำเร็จ', true);
      clearPagination();
      return;
    }
    const visible = getVisibleTasks();
    if (visible.length === 0) {
      const text = tasks.length === 0
        ? 'ยังไม่มีงานในรายการ'
        : currentFilter === 'completed'
          ? 'ไม่มีงานที่เสร็จแล้ว'
          : currentFilter === 'incomplete'
            ? 'ไม่มีงานที่ยังไม่เสร็จ'
            : 'ไม่พบงาน';
      renderEmptyState(text);
      clearPagination();
      return;
    }
    const pageCount = Math.ceil(visible.length / TASKS_PER_PAGE);
    currentPage = Math.min(currentPage, pageCount);
    renderPagination(visible.length);
    const firstIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const pageTasks = visible.slice(firstIndex, firstIndex + TASKS_PER_PAGE);
    taskList.replaceChildren(...pageTasks.map((task) => makeTaskCard(task, {
      pending: pendingIds.has(Number(task.id)),
      onToggle: toggleCompletion,
      onStatusChange: changeTaskStatus,
      onDelete: removeTask,
    })));
  }

  function renderFilters() {
    filterGroup.replaceChildren(...FILTERS.map((filter) => {
      const button = element('button', 'deadline-filter', filter.label);
      button.type = 'button';
      button.dataset.filter = filter.id;
      button.setAttribute('aria-pressed', String(currentFilter === filter.id));
      button.addEventListener('click', () => {
        currentFilter = filter.id;
        currentPage = 1;
        renderFilters();
        renderTasks();
      });
      return button;
    }));
  }

  function renderWeek() {
    const start = new Date(now());
    start.setHours(0, 0, 0, 0);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    const todayKey = localDateKey(new Date(now()));
    const days = [];
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = localDateKey(day);
      const count = tasks.filter((task) => {
        const dueAt = new Date(task.due_at);
        return !Number.isNaN(dueAt.getTime()) && localDateKey(dueAt) === key;
      }).length;
      const cell = element('div', `deadline-week-day${key === todayKey ? ' is-today' : ''}`);
      cell.dataset.role = 'week-day';
      cell.dataset.date = key;
      cell.append(
        element('span', 'deadline-week-day__name', new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(day)),
        element('time', 'deadline-week-day__date', new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(day)),
        element('strong', 'deadline-week-day__count', String(count)),
      );
      cell.querySelector('.deadline-week-day__count').dataset.role = 'week-count';
      days.push(cell);
    }
    weekGrid.replaceChildren(...days);
  }

  async function refreshTasks() {
    loading = true;
    loadFailed = false;
    currentPage = 1;
    renderTasks();
    setMessage('');
    try {
      const result = await loadDeadlines();
      tasks = Array.isArray(result) ? result.map((task) => ({ ...task })) : [];
    } catch (error) {
      tasks = [];
      loadFailed = true;
      setMessage(error?.message || 'โหลดรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      loading = false;
      renderTasks();
      renderWeek();
    }
  }

  async function toggleCompletion(task) {
    const id = Number(task.id);
    if (pendingIds.has(id)) return;
    const previousStatus = taskStatus(task);
    const nextStatus = previousStatus === 'completed' ? 'not_started' : 'completed';
    pendingIds.add(id);
    tasks = tasks.map((item) => Number(item.id) === id
      ? { ...item, status: nextStatus, is_completed: nextStatus === 'completed' }
      : item);
    renderTasks();
    renderWeek();
    setMessage('กำลังอัปเดตสถานะ…');
    try {
      const updated = await updateDeadline(id, { status: nextStatus });
      if (updated && Number(updated.id) === id) {
        tasks = tasks.map((item) => Number(item.id) === id ? { ...item, ...updated } : item);
      }
      setMessage(nextStatus === 'completed' ? 'ทำเครื่องหมายเสร็จแล้ว' : 'ย้ายกลับไปยังงานที่ยังไม่เริ่มแล้ว');
    } catch (error) {
      tasks = tasks.map((item) => Number(item.id) === id
        ? { ...item, status: previousStatus, is_completed: previousStatus === 'completed' }
        : item);
      setMessage(error?.message || 'อัปเดตสถานะไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      pendingIds.delete(id);
      renderTasks();
      renderWeek();
    }
  }

  async function changeTaskStatus(task, nextStatus) {
    const id = Number(task.id);
    if (pendingIds.has(id) || !TASK_STATUSES.some((item) => item.id === nextStatus)) return;
    const previousStatus = taskStatus(task);
    if (previousStatus === nextStatus) return;
    pendingIds.add(id);
    tasks = tasks.map((item) => Number(item.id) === id
      ? { ...item, status: nextStatus, is_completed: nextStatus === 'completed' }
      : item);
    renderTasks();
    setMessage('กำลังอัปเดตสถานะ…');
    try {
      const updated = await updateDeadline(id, { status: nextStatus });
      if (updated && Number(updated.id) === id) {
        tasks = tasks.map((item) => Number(item.id) === id ? { ...item, ...updated } : item);
      }
      setMessage(`อัปเดตเป็น${statusLabel(nextStatus)}แล้ว`);
    } catch (error) {
      tasks = tasks.map((item) => Number(item.id) === id
        ? { ...item, status: previousStatus, is_completed: previousStatus === 'completed' }
        : item);
      setMessage(error?.message || 'อัปเดตสถานะไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      pendingIds.delete(id);
      renderTasks();
    }
  }

  async function removeTask(task) {
    const id = Number(task.id);
    if (pendingIds.has(id)) return;
    if (!confirmDelete(`ต้องการลบงาน “${task.title}” หรือไม่?`)) return;
    pendingIds.add(id);
    renderTasks();
    try {
      await deleteDeadline(id);
      tasks = tasks.filter((item) => Number(item.id) !== id);
      setMessage('ลบงานแล้ว');
    } catch (error) {
      setMessage(error?.message || 'ลบงานไม่สำเร็จ งานยังอยู่ในรายการ', true);
    } finally {
      pendingIds.delete(id);
      renderTasks();
      renderWeek();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (creating) return;
    const title = titleInput.value.trim();
    const tagId = Number(subjectSelect.value);
    if (!title || !availableSubjects.has(tagId) || !dateInput.value || !timeInput.value || !prioritySelect.value) {
      setMessage('กรุณากรอกชื่องาน วิชา วันส่ง เวลา และระดับความเร่งด่วนให้ครบ', true);
      return;
    }
    const dueAt = new Date(`${dateInput.value}T${timeInput.value}`);
    if (Number.isNaN(dueAt.getTime())) {
      setMessage('วันหรือเวลาที่เลือกไม่ถูกต้อง', true);
      return;
    }

    creating = true;
    submitButton.disabled = true;
    setMessage('กำลังบันทึกงาน…');
    try {
      const created = await createDeadline({
        title,
        tag_id: tagId,
        due_at: dueAt.toISOString(),
        priority: prioritySelect.value,
      });
      if (!created || !Number.isSafeInteger(created.id) || created.id <= 0) {
        throw new Error('บันทึกงานไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
      tasks = sortByCreatedAt([...tasks, { ...created }]);
      currentPage = 1;
      loadFailed = false;
      form.reset();
      setMessage('เพิ่มงานลงในรายการแล้ว');
      renderTasks();
      renderWeek();
      onDeadlineCreated(created);
    } catch (error) {
      setMessage(error?.message || 'บันทึกงานไม่สำเร็จ กรุณาลองอีกครั้ง', true);
    } finally {
      creating = false;
      submitButton.disabled = false;
    }
  });

  renderFilters();
  renderTasks();
  renderWeek();
  void refreshSubjectTags();
  void refreshTasks();
  return page;
}
