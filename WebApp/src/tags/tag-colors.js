export const TAG_COLOR_PALETTE = Object.freeze([
  Object.freeze({ key: 'violet', label: 'Violet' }),
  Object.freeze({ key: 'blue', label: 'Blue' }),
  Object.freeze({ key: 'cyan', label: 'Cyan' }),
  Object.freeze({ key: 'teal', label: 'Teal' }),
  Object.freeze({ key: 'green', label: 'Green' }),
  Object.freeze({ key: 'lime', label: 'Lime' }),
  Object.freeze({ key: 'amber', label: 'Amber' }),
  Object.freeze({ key: 'orange', label: 'Orange' }),
  Object.freeze({ key: 'rose', label: 'Rose' }),
  Object.freeze({ key: 'pink', label: 'Pink' }),
]);

export const TAG_COLOR_KEYS = Object.freeze(TAG_COLOR_PALETTE.map(({ key }) => key));
export const DEFAULT_TAG_COLOR = 'violet';

const tagColorKeySet = new Set(TAG_COLOR_KEYS);

export function normalizeTagColor(color) {
  return tagColorKeySet.has(color) ? color : DEFAULT_TAG_COLOR;
}
