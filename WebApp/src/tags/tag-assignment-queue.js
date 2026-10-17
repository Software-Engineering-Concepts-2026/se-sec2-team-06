function normalizeTagIds(tagIds) {
  return [...new Set((tagIds ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function sameTagIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function createTagAssignmentQueue({
  initialTagIds = [],
  save,
  onChange = () => {},
  onError = () => {},
}) {
  if (typeof save !== 'function') {
    throw new TypeError('A tag save function is required');
  }

  let confirmedTagIds = normalizeTagIds(initialTagIds);
  let desiredTagIds = [...confirmedTagIds];
  let isSaving = false;

  async function drain() {
    if (isSaving) return;
    isSaving = true;
    try {
      while (!sameTagIds(desiredTagIds, confirmedTagIds)) {
        const requestedTagIds = [...desiredTagIds];
        try {
          await save([...requestedTagIds]);
          confirmedTagIds = requestedTagIds;
        } catch (error) {
          desiredTagIds = [...confirmedTagIds];
          onChange([...desiredTagIds]);
          onError(error);
          return;
        }
      }
    } finally {
      isSaving = false;
    }
  }

  function updateDesired(nextTagIds) {
    desiredTagIds = normalizeTagIds(nextTagIds);
    onChange([...desiredTagIds]);
    void drain();
  }

  return {
    toggle(tagId) {
      const id = Number(tagId);
      if (!Number.isInteger(id) || id <= 0) return;
      const nextTagIds = new Set(desiredTagIds);
      if (nextTagIds.has(id)) nextTagIds.delete(id);
      else nextTagIds.add(id);
      updateDesired([...nextTagIds]);
    },
    include(tagId) {
      const id = Number(tagId);
      if (!Number.isInteger(id) || id <= 0 || desiredTagIds.includes(id)) return;
      updateDesired([...desiredTagIds, id]);
    },
    replace(tagIds) {
      updateDesired(tagIds);
    },
    getTagIds() {
      return [...desiredTagIds];
    },
  };
}
