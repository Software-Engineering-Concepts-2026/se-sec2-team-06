import { getTheme, getThemes } from '../theme/theme-config.js';

const NOTIFICATION_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

const NAV_ITEMS = [
  { id: 'home', label: 'หน้าหลัก', path: '/', icon: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6' },
  { id: 'tutor', label: 'AI ติวเตอร์', path: '/tutor', icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5v15M8 7h8M8 10h6' },
  { id: 'quizzes', label: 'คลังข้อสอบ', path: '/quizzes', icon: 'M7 3.5h8l4 4V20H7zM15 3.5v4h4M10 12h6M10 15.5h6' },
  { id: 'documents', label: 'คลังเอกสาร', path: '/documents', icon: 'M6 3.5h8l4 4V20H6zM14 3.5v4h4M9 12h6M9 15h6M9 18h4' },
  { id: 'deadlines', label: 'กำหนดส่งงาน', path: '/deadlines', icon: 'M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2M8 13h3m-3 3h6' },
];

function appendIcon(container, pathData, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('nav-icon');
  if (className) svg.classList.add(className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.7');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  container.append(svg);
}

function createLink(label, path, navigate, className = '') {
  const link = document.createElement('a');
  link.href = path;
  link.textContent = label;
  link.className = className;
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate?.(path);
  });
  return link;
}

function isPathActive(path, currentPath) {
  if (path === '/') return currentPath === '/';
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

function createThemeSelector(themeId, onThemeChange) {
  const label = document.createElement('label');
  label.className = 'theme-selector';
  label.htmlFor = 'theme-select';
  const labelText = document.createElement('span');
  labelText.className = 'theme-selector__label';
  labelText.textContent = 'ธีม';
  const select = document.createElement('select');
  select.id = 'theme-select';
  select.className = 'button button-quiet theme-selector__select themed-select';
  select.dataset.action = 'theme-select';
  select.setAttribute('aria-label', 'ธีม');
  for (const { id, label: themeName } of getThemes()) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = themeName;
    select.append(option);
  }
  select.value = getTheme(themeId).id;
  select.addEventListener('change', () => onThemeChange?.(select.value));
  label.append(labelText, select);
  return label;
}

function createNavItem(item, currentPath, navigate) {
  const link = createLink(item.label, item.path, navigate, 'nav-dock__link');
  link.dataset.navSection = item.id;
  if (isPathActive(item.path, currentPath)) link.setAttribute('aria-current', 'page');
  const iconWrap = document.createElement('span');
  iconWrap.className = 'nav-dock__icon-wrap';
  iconWrap.setAttribute('aria-hidden', 'true');
  appendIcon(iconWrap, item.icon);
  const label = document.createElement('span');
  label.className = 'nav-dock__label';
  label.textContent = item.label;
  link.replaceChildren(iconWrap, label);
  return link;
}

function createNotifications(navigate, loadDeadlines, now) {
  const notifications = document.createElement('div');
  notifications.className = 'nav-notifications';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'button button-quiet nav-notifications__toggle';
  toggle.dataset.action = 'notifications-toggle';
  toggle.setAttribute('aria-label', 'แจ้งเตือนงานใกล้ครบกำหนด');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'nav-notifications-panel');
  toggle.dataset.hasNotifications = 'false';
  const bellPath = 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4';
  appendIcon(toggle, bellPath, 'nav-notifications__icon');
  const count = document.createElement('span');
  count.className = 'nav-notifications__count';
  count.dataset.role = 'notification-count';
  count.hidden = true;
  toggle.append(count);

  const panel = document.createElement('section');
  panel.className = 'nav-notifications__panel';
  panel.id = 'nav-notifications-panel';
  panel.dataset.role = 'notifications-panel';
  panel.setAttribute('aria-label', 'การแจ้งเตือนงาน');
  panel.hidden = true;
  const heading = document.createElement('h2');
  heading.className = 'nav-notifications__heading';
  heading.textContent = 'งานใกล้ครบกำหนด';
  const note = document.createElement('p');
  note.className = 'nav-notifications__note';
  note.textContent = 'แสดงเฉพาะงานที่ครบกำหนดภายใน 5 วัน';
  const state = document.createElement('p');
  state.className = 'nav-notifications__state';
  state.dataset.role = 'notifications-state';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.textContent = 'กำลังโหลดการแจ้งเตือน…';
  const list = document.createElement('div');
  list.className = 'nav-notifications__list';
  const viewAll = createLink('ดูงานทั้งหมด', '/deadlines', navigate, 'nav-notifications__all');
  panel.append(heading, note, state, list, viewAll);
  let refreshVersion = 0;
  let currentNotifications = [];
  const isUpcoming = (task, currentTime) => {
    const dueAt = new Date(task?.due_at).getTime();
    return !task?.is_completed
      && Number.isFinite(dueAt)
      && dueAt >= currentTime
      && dueAt <= currentTime + NOTIFICATION_WINDOW_MS;
  };
  const renderNotifications = (upcoming, assignedTaskId = null) => {
    currentNotifications = upcoming;
    count.textContent = String(upcoming.length);
    count.hidden = upcoming.length === 0;
    toggle.dataset.hasNotifications = String(upcoming.length > 0);
    if (upcoming.length === 0) {
      state.textContent = 'ไม่มีงานที่ครบกำหนดภายใน 5 วัน';
      list.replaceChildren();
      return;
    }
    state.textContent = `มี ${upcoming.length} งานที่ใกล้ครบกำหนด`;
    list.replaceChildren(...upcoming.map((task) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'nav-notifications__item';
      item.dataset.notificationId = String(task.id);
      if (String(task.id) === String(assignedTaskId)) item.dataset.newlyAssigned = 'true';
      const title = document.createElement('strong');
      title.textContent = task.title || 'งานไม่มีชื่อ';
      const details = document.createElement('span');
      const dueAt = new Date(task.due_at);
      details.textContent = `${task.subject || 'ไม่ระบุวิชา'} · ${new Intl.DateTimeFormat('th-TH', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }).format(dueAt)}`;
      item.append(title, details);
      item.addEventListener('click', () => navigate?.('/deadlines'));
      return item;
    }));
  };
  const refresh = ({ assignedTask } = {}) => {
    const assignedDueAt = new Date(assignedTask?.due_at).getTime();
    const currentTime = now().getTime();
    const shouldRevealAssignment = Number.isSafeInteger(Number(assignedTask?.id))
      && !assignedTask?.is_completed
      && Number.isFinite(assignedDueAt)
      && assignedDueAt >= currentTime
      && assignedDueAt <= currentTime + NOTIFICATION_WINDOW_MS;
    const version = ++refreshVersion;
    state.textContent = 'กำลังโหลดการแจ้งเตือน…';
    list.replaceChildren();
    if (shouldRevealAssignment) {
      toggle.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      const optimisticTasks = [
        ...currentNotifications.filter((task) => String(task.id) !== String(assignedTask.id)),
        assignedTask,
      ].filter((task) => isUpcoming(task, currentTime))
        .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime());
      renderNotifications(optimisticTasks, assignedTask.id);
    }
    Promise.resolve()
      .then(() => loadDeadlines())
      .then((tasks) => {
        if (version !== refreshVersion) return;
        const taskList = Array.isArray(tasks) ? [...tasks] : [];
        if (shouldRevealAssignment && !taskList.some((task) => String(task?.id) === String(assignedTask.id))) {
          taskList.push(assignedTask);
        }
        const upcoming = taskList
          .filter((task) => isUpcoming(task, now().getTime()))
          .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime());
        renderNotifications(upcoming, shouldRevealAssignment ? assignedTask.id : null);
      })
      .catch(() => {
        if (version !== refreshVersion) return;
        state.textContent = shouldRevealAssignment
          ? 'แสดงงานใหม่แล้ว แต่โหลดรายการอื่นไม่สำเร็จ'
          : 'โหลดการแจ้งเตือนไม่สำเร็จ';
      });
  };
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    if (!expanded) refresh();
  });
  notifications.append(toggle, panel);
  refresh();

  return { element: notifications, refresh };
}

function createThemeMenu(themeId, onThemeChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-theme-menu';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-popover__link nav-theme-menu__toggle';
  button.dataset.action = 'theme-toggle';
  button.setAttribute('aria-label', 'เลือกธีม');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'nav-theme-panel');
  button.textContent = `ธีม · ${getTheme(themeId).label}`;

  const panel = document.createElement('div');
  panel.className = 'nav-theme-menu__panel';
  panel.id = 'nav-theme-panel';
  panel.dataset.role = 'theme-panel';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'เลือกธีม');
  panel.hidden = true;
  for (const theme of getThemes()) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'nav-theme-menu__option';
    option.dataset.themeId = theme.id;
    option.textContent = theme.label;
    option.setAttribute('aria-pressed', String(getTheme(themeId).id === theme.id));
    option.addEventListener('click', () => {
      panel.querySelectorAll('[data-theme-id]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === option));
      });
      button.textContent = `ธีม · ${theme.label}`;
      onThemeChange?.(theme.id);
    });
    panel.append(option);
  }
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
  wrapper.append(button, panel);
  return wrapper;
}

function createAccountMenu(user, { currentPath, navigate, onLogout, themeId, onThemeChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-account';
  const displayName = user.display_name || user.email || 'บัญชีของฉัน';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-quiet nav-account__toggle';
  button.dataset.action = 'account-toggle';
  button.setAttribute('aria-label', `บัญชี ${displayName}`);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'nav-account-panel');
  const avatar = document.createElement('img');
  avatar.className = 'nav-account__avatar';
  avatar.alt = '';
  avatar.hidden = !user.avatar_url;
  if (user.avatar_url) avatar.src = user.avatar_url;
  const initial = document.createElement('span');
  initial.className = 'nav-account__initial';
  initial.setAttribute('aria-hidden', 'true');
  initial.textContent = String(displayName || 'S').trim().charAt(0).toUpperCase() || 'S';
  initial.hidden = Boolean(user.avatar_url);
  avatar.addEventListener('error', () => {
    avatar.hidden = true;
    initial.hidden = false;
  });
  const portrait = document.createElement('span');
  portrait.className = 'nav-account__portrait';
  portrait.setAttribute('aria-hidden', 'true');
  portrait.append(avatar, initial);
  const name = document.createElement('span');
  name.className = 'nav-account__name';
  name.textContent = displayName;
  button.append(portrait, name);

  const panel = document.createElement('section');
  panel.className = 'nav-popover nav-account__panel';
  panel.id = 'nav-account-panel';
  panel.dataset.role = 'account-panel';
  panel.setAttribute('aria-label', 'เมนูบัญชี');
  panel.hidden = true;
  const heading = document.createElement('h2');
  heading.className = 'nav-popover__heading';
  heading.textContent = displayName;
  const profile = createLink('ตั้งค่าโปรไฟล์', '/profile', navigate, 'nav-popover__link');
  if (isPathActive('/profile', currentPath)) profile.setAttribute('aria-current', 'page');
  const progress = createLink('ความก้าวหน้า', '/progress', navigate, 'nav-popover__link');
  if (isPathActive('/progress', currentPath)) progress.setAttribute('aria-current', 'page');
  const themeMenu = createThemeMenu(themeId, onThemeChange);
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'nav-popover__link nav-popover__logout';
  logout.dataset.action = 'logout';
  logout.textContent = 'ออกจากระบบ';
  logout.addEventListener('click', () => onLogout?.());
  panel.append(heading, profile, progress, themeMenu, logout);
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
  wrapper.append(button, panel);
  return wrapper;
}

export function renderNavbar(user, {
  navigate,
  onLogout,
  themeId = 'dark',
  onThemeChange,
  loadDeadlines = async () => [],
  now = () => new Date(),
  currentPath = '/',
  navigationMotion = { activeTabId: null },
} = {}) {
  const navigation = document.createElement('div');
  navigation.className = 'app-navigation';
  const header = document.createElement('header');
  header.className = 'site-header';
  const nav = document.createElement('div');
  nav.className = 'navbar';

  const brand = createLink('SynapseSync', '/', navigate, 'brand');
  const brandMark = document.createElement('img');
  brandMark.className = 'brand-mark';
  brandMark.src = '/brand-logo.png';
  brandMark.alt = '';
  brandMark.setAttribute('aria-hidden', 'true');
  brand.prepend(brandMark);

  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  let refreshNotifications = () => {};
  if (user) {
    const notificationControl = createNotifications(navigate, loadDeadlines, now);
    tools.append(notificationControl.element);
    refreshNotifications = notificationControl.refresh;
    tools.append(createAccountMenu(user, { currentPath, navigate, onLogout, themeId, onThemeChange }));
  } else {
    tools.append(createLink('เข้าสู่ระบบ', '/login', navigate, 'nav-auth-link'));
    tools.append(createLink('สมัครสมาชิก', '/register', navigate, 'button button-primary nav-cta'));
    tools.append(createThemeSelector(themeId, onThemeChange));
  }

  nav.append(brand, tools);
  header.append(nav);

  const dock = document.createElement('nav');
  dock.className = 'nav-dock';
  dock.setAttribute('aria-label', 'เมนูหลักด้านล่าง');
  const visibleItems = NAV_ITEMS.filter((item) => user || item.id === 'home');
  const activeIndex = visibleItems.findIndex((item) => isPathActive(item.path, currentPath));
  let orbDirection = 'idle';
  let orbOffset = '0cqi';
  if (activeIndex >= 0) {
    const previousIndex = visibleItems.findIndex((item) => item.id === navigationMotion.activeTabId);
    if (previousIndex < 0) {
      orbDirection = 'enter';
    } else if (previousIndex < activeIndex) {
      orbDirection = 'right';
    } else if (previousIndex > activeIndex) {
      orbDirection = 'left';
    } else {
      orbDirection = 'stay';
    }
    if (previousIndex >= 0) {
      const stepPercent = 100 / visibleItems.length;
      orbOffset = `${(previousIndex - activeIndex) * stepPercent}cqi`;
    }
    navigationMotion.activeTabId = visibleItems[activeIndex].id;
  }
  dock.dataset.orbDirection = orbDirection;
  dock.style.setProperty('--nav-orb-slide-offset', orbOffset);
  for (const item of visibleItems) dock.append(createNavItem(item, currentPath, navigate));

  navigation.append(header, dock);
  navigation.refreshNotifications = refreshNotifications;
  return navigation;
}
