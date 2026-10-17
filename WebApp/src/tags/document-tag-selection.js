function flattenTags(catalog) {
  return Array.isArray(catalog?.tags) ? catalog.tags : [];
}

function resolveTag(tagId, catalog) {
  return flattenTags(catalog).find((tag) => Number(tag.id) === Number(tagId)) ?? null;
}

export function nextDocumentTagSelection(currentTagIds, toggledTagId, catalog) {
  const current = new Set(currentTagIds.map(Number));
  const tag = resolveTag(toggledTagId, catalog);
  if (!tag) return [...current];
  const tagId = Number(tag.id);
  if (current.has(tagId)) return [...current].filter((id) => id !== tagId);
  return [...current, tagId];
}
