import { getTheme } from './theme-config.js';

export const THEME_STORAGE_KEY = 'synapsesync-theme';

function getBrowserStorage() {
  try {
    return globalThis.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function getDocumentRoot() {
  try {
    return globalThis.document?.documentElement ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(storage) {
  return storage === undefined ? getBrowserStorage() : storage;
}

function resolveRoot(root) {
  return root === undefined ? getDocumentRoot() : root;
}

function applyTheme(theme, root) {
  if (!root) return;

  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.colorScheme;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(token, value);
  }
}

export function initializeTheme({ storage, root } = {}) {
  let savedThemeId = null;
  try {
    savedThemeId = resolveStorage(storage)?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    savedThemeId = null;
  }

  const theme = getTheme(savedThemeId);
  applyTheme(theme, resolveRoot(root));
  return theme.id;
}

export function setTheme(themeId, { storage, root } = {}) {
  const theme = getTheme(themeId);
  applyTheme(theme, resolveRoot(root));

  try {
    resolveStorage(storage)?.setItem(THEME_STORAGE_KEY, theme.id);
  } catch {
    // Keep the selection active for this session when browser storage is unavailable.
  }

  return theme.id;
}
