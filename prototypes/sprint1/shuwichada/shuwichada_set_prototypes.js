(() => {
  const form = document.getElementById('deadline-form');
  const titleInput = document.getElementById('task-title');
  const subjectInput = document.getElementById('task-subject');
  const dateInput = document.getElementById('task-date');
  const timeInput = document.getElementById('task-time');
  const reminderInput = document.getElementById('task-reminder');
  const statusEl = document.getElementById('deadline-status');
  const filterButtonsEl = document.getElementById('filter-buttons');
  const taskListEl = document.getElementById('task-list');
  const taskEmptyEl = document.getElementById('task-empty');
  const plannerEl = document.getElementById('planner');

  const priorityLabels = {
    high: 'ด่วน',
    medium: 'ปานกลาง',
    low: 'ไม่ด่วน',
  };

  const dayLabels = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const state = {
    filter: 'all',
    tasks: [
      createTask('การบ้านฟิสิกส์ บทที่ 5', 'ฟิสิกส์', daysFromNow(1, '23:59'), 'high', 1, false),
      createTask('โจทย์คณิตศาสตร์ บทที่ 3', 'คณิตศาสตร์', daysFromNow(3, '15:00'), 'medium', 3, false),
      createTask('รายงานเคมี เรื่องโมล', 'เคมี', daysFromNow(-1, '17:00'), 'low', 0, true),
    ],
  };

  function createTask(title, subject, dueAt, priority, reminderDays, completed) {
    return {
      id: `task-${Math.random().toString(36).slice(2, 9)}`,
      title,
      subject,
      dueAt,
      priority,
      reminderDays: Number(reminderDays),
      completed,
    };
  }

  function daysFromNow(offset, time) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDue(iso) {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  function formatReminder(days) {
    if (!days) return 'ไม่แจ้งเตือน';
    return days === 1 ? 'เตือน 1 วันก่อน' : `เตือน ${days} วันก่อน`;
  }

  function setStatus(message, stateName = 'error') {
    statusEl.textContent = message;
    statusEl.dataset.state = stateName;
  }

  function renderFilters() {
    const filters = [
      ['all', 'ทั้งหมด'],
      ['pending', 'ยังไม่เสร็จ'],
      ['completed', 'เสร็จแล้ว'],
    ];
    filterButtonsEl.innerHTML = filters.map(([value, label]) => `
      <button class="filter-button" type="button" data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>
    `).join('');
  }

  function filteredTasks() {
    return state.tasks
      .filter((task) => state.filter === 'all' || (state.filter === 'completed' ? task.completed : !task.completed))
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  }

  function taskCard(task) {
    const priorityClass = task.priority === 'high' ? ' task-badge--high' : '';
    const completion = task.completed
      ? '<span class="task-badge task-badge--done">เสร็จแล้ว</span>'
      : `<span class="task-badge${priorityClass}">${priorityLabels[task.priority]}</span>`;
    return `
      <article class="task-card${task.completed ? ' is-completed' : ''}" data-task-card data-task-id="${task.id}">
        <div>
          <p class="task-title">${escapeHtml(task.title)}</p>
          <div class="task-meta">
            <span>${escapeHtml(task.subject)}</span>
            <span>ส่ง ${formatDue(task.dueAt)}</span>
            <span>${formatReminder(task.reminderDays)}</span>
          </div>
          <div class="task-meta">${completion}</div>
        </div>
        <div class="task-actions">
          <button class="task-action" type="button" data-action="toggle" aria-label="${task.completed ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'ทำเครื่องหมายว่าเสร็จแล้ว'}">${task.completed ? '↶' : '✓'}</button>
          <button class="task-action task-action--delete" type="button" data-action="delete" aria-label="ลบงาน">×</button>
        </div>
      </article>
    `;
  }

  function renderTasks() {
    const visibleTasks = filteredTasks();
    taskListEl.innerHTML = visibleTasks.map(taskCard).join('');
    taskEmptyEl.hidden = visibleTasks.length > 0;
  }

  function startOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function renderPlanner() {
    const monday = startOfWeek(new Date());
    plannerEl.innerHTML = dayLabels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const key = dateKey(date);
      const dayTasks = state.tasks.filter((task) => dateKey(new Date(task.dueAt)) === key);
      const dots = dayTasks.map((task) => `<i class="planner-day__dot${task.completed ? ' is-completed' : ''}" title="${escapeHtml(task.title)}"></i>`).join('');
      const isToday = dateKey(new Date()) === key;
      return `
        <div class="planner-day${isToday ? ' is-today' : ''}">
          <span>${label}</span>
          <span class="planner-day__date">${date.getDate()}</span>
          <span class="planner-day__dots">${dots}</span>
        </div>
      `;
    }).join('');
  }

  function render() {
    renderFilters();
    renderTasks();
    renderPlanner();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      setStatus('กรุณากรอกชื่องาน');
      titleInput.focus();
      return;
    }
    if (!subjectInput.value || !dateInput.value || !timeInput.value) {
      setStatus('กรุณากรอกวิชา วันที่ และเวลาให้ครบ');
      return;
    }

    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
    const dueAt = new Date(`${dateInput.value}T${timeInput.value}`).toISOString();
    state.tasks.push(createTask(title, subjectInput.value, dueAt, priority, reminderInput.value, false));
    form.reset();
    document.querySelector('input[name="priority"][value="high"]').checked = true;
    setStatus('เพิ่มกำหนดส่งแล้ว', 'success');
    state.filter = 'all';
    render();
  });

  filterButtonsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderFilters();
    renderTasks();
  });

  taskListEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-task-card]');
    const task = state.tasks.find((item) => item.id === card?.dataset.taskId);
    if (!task) return;

    if (button.dataset.action === 'toggle') {
      task.completed = !task.completed;
      setStatus(task.completed ? 'ทำเครื่องหมายว่างานเสร็จแล้ว' : 'เปิดงานกลับมาแล้ว', 'success');
    }
    if (button.dataset.action === 'delete') {
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      setStatus('ลบงานแล้ว', 'success');
    }
    render();
  });

  render();
})();
