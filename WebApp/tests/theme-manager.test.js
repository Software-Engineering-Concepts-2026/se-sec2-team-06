// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { getTheme, getThemes } from '../src/theme/theme-config.js';
import { initializeTheme, setTheme } from '../src/theme/theme-manager.js';

const REQUIRED_TOKENS = [
  '--page',
  '--page-gradient',
  '--ink',
  '--muted',
  '--subtle',
  '--line',
  '--line-strong',
  '--nav-surface',
  '--nav-ink',
  '--nav-muted',
  '--surface',
  '--surface-raised',
  '--surface-input',
  '--surface-hover',
  '--surface-muted',
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-ink',
  '--accent-gradient',
  '--accent-gradient-hover',
  '--accent-shadow',
  '--focus-ring',
  '--focus-shadow',
  '--success',
  '--success-soft',
  '--error',
  '--error-soft',
  '--warning',
  '--warning-soft',
  '--on-status',
  '--cyan',
  '--shadow',
  '--glass',
  '--overlay',
  '--track',
  '--avatar-surface',
  '--avatar-ring',
  '--brand-glow',
  '--surface-highlight',
  '--surface-card',
  '--select-focus',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
];

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function relativeLuminance(hexColor) {
  const channels = hexColor.slice(1).match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4));

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('shared theme configuration and manager', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
    window.localStorage.clear();
  });

  it('offers five named palettes with every shared semantic token', () => {
    const themes = getThemes();
    expect(themes.map(({ id }) => id)).toEqual(['monochrome', 'dark', 'light', 'purple', 'black-aura']);
    expect(themes.map(({ label }) => label)).toEqual(['ขาวดำ', 'มืด', 'สว่าง', 'ม่วงเข้ม', 'ดำออร่า']);
    for (const theme of themes) {
      for (const token of REQUIRED_TOKENS) {
        expect(theme.tokens[token], `${theme.id} is missing ${token}`).toBeTruthy();
      }
    }
  });

  it('uses a grayscale interface palette while retaining the existing chart colors', () => {
    const theme = getTheme('monochrome');

    expect(theme.id).toBe('monochrome');
    expect(theme.colorScheme).toBe('light');
    expect(theme.tokens['--page']).toBe('#f5f5f5');
    expect(theme.tokens['--ink']).toBe('#1c1c1c');
    expect(theme.tokens['--accent']).toBe('#262626');
    expect(relativeLuminance(theme.tokens['--nav-surface']))
      .toBeLessThan(relativeLuminance(theme.tokens['--page']));
    expect(contrastRatio(theme.tokens['--nav-ink'], theme.tokens['--nav-surface']))
      .toBeGreaterThanOrEqual(7);
    expect(contrastRatio(theme.tokens['--nav-surface'], theme.tokens['--page']))
      .toBeGreaterThanOrEqual(7);
    expect([
      theme.tokens['--chart-1'],
      theme.tokens['--chart-2'],
      theme.tokens['--chart-3'],
      theme.tokens['--chart-4'],
      theme.tokens['--chart-5'],
    ]).toEqual(['#c4b5fd', '#93c5fd', '#5eead4', '#fcd34d', '#fda4af']);
  });

  it('applies and persists the black aura theme with its black surface and red accent', () => {
    const storage = memoryStorage();

    expect(setTheme('black-aura', { storage })).toBe('black-aura');
    expect(document.documentElement.dataset.theme).toBe('black-aura');
    expect(document.documentElement.style.getPropertyValue('--page')).toBe('#070707');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#dc2626');
    expect(storage.getItem('synapsesync-theme')).toBe('black-aura');
  });

  it('keeps small text and status markers readable at WCAG AA contrast', () => {
    const lightTheme = getTheme('light');

    expect(contrastRatio(lightTheme.tokens['--subtle'], lightTheme.tokens['--page']))
      .toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightTheme.tokens['--subtle'], '#ffffff'))
      .toBeGreaterThanOrEqual(4.5);

    for (const theme of getThemes()) {
      for (const gradientToken of ['--accent-gradient', '--accent-gradient-hover']) {
        const gradientColors = theme.tokens[gradientToken].match(/#[\da-f]{6}/gi);

        for (const background of gradientColors) {
          expect(
            contrastRatio(theme.tokens['--accent-ink'], background),
            `${theme.id} ${gradientToken} label contrast on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }

      for (const statusToken of ['--success', '--error', '--warning']) {
        expect(
          contrastRatio(theme.tokens['--on-status'], theme.tokens[statusToken]),
          `${theme.id} status marker contrast on ${statusToken}`,
        ).toBeGreaterThanOrEqual(4.5);
      }

    }
  });

  it('test_all_themes_define_chart_and_control_tokens', () => {
    for (const theme of getThemes()) {
      expect(theme.tokens['--surface-card'], `${theme.id} card surface`).toBeTruthy();
      expect(theme.tokens['--select-focus'], `${theme.id} select focus`).toBeTruthy();
      for (const token of ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']) {
        expect(theme.tokens[token], `${theme.id} ${token}`).toMatch(/^#[\da-f]{6}$/i);
      }
    }
  });

  it('test_semantic_status_tokens_meet_small_text_contrast', () => {
    for (const theme of getThemes()) {
      for (const token of ['--success', '--error']) {
        expect(
          contrastRatio(theme.tokens['--on-status'], theme.tokens[token]),
          `${theme.id} ${token} label contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('returns the black aura definition for an unknown theme ID', () => {
    expect(getTheme('not-a-theme').id).toBe('black-aura');
  });

  it('uses the black aura theme when no theme has been saved', () => {
    expect(initializeTheme({ storage: memoryStorage() })).toBe('black-aura');
    expect(document.documentElement.dataset.theme).toBe('black-aura');
  });

  it('uses the black aura theme when the saved theme ID is unknown', () => {
    expect(initializeTheme({ storage: memoryStorage({ 'synapsesync-theme': 'neon' }) }))
      .toBe('black-aura');
    expect(document.documentElement.dataset.theme).toBe('black-aura');
  });

  it('preserves an explicitly saved dark theme', () => {
    expect(initializeTheme({ storage: memoryStorage({ 'synapsesync-theme': 'dark' }) }))
      .toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restores a valid saved theme and applies all of its root tokens', () => {
    const root = document.documentElement;
    const effectiveId = initializeTheme({
      storage: memoryStorage({ 'synapsesync-theme': 'purple' }),
      root,
    });
    const theme = getTheme('purple');

    expect(effectiveId).toBe('purple');
    expect(root.dataset.theme).toBe('purple');
    expect(root.style.colorScheme).toBe(theme.colorScheme);
    for (const [token, value] of Object.entries(theme.tokens)) {
      expect(root.style.getPropertyValue(token)).toBe(value);
    }
  });

  it('applies a selected theme immediately and persists its ID', () => {
    const storage = memoryStorage();

    expect(setTheme('light', { storage })).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(storage.getItem('synapsesync-theme')).toBe('light');
  });

  it('falls back safely when reading saved theme storage fails', () => {
    const storage = { getItem() { throw new Error('storage unavailable'); } };

    expect(() => initializeTheme({ storage })).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('black-aura');
  });

  it('keeps the selected theme active for this session when persistence fails', () => {
    const storage = {
      getItem() { return null; },
      setItem() { throw new Error('storage unavailable'); },
    };

    expect(() => setTheme('purple', { storage })).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('purple');
  });

  it('falls back safely when accessing browser localStorage throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage access denied'); },
    });

    try {
      expect(() => initializeTheme()).not.toThrow();
      expect(document.documentElement.dataset.theme).toBe('black-aura');
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }
  });
});
