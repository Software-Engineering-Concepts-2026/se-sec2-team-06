// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createTagAssignmentQueue } from '../src/tags/tag-assignment-queue.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('per-quiz tag assignment queue', () => {
  it('test_rapid_tag_toggles_are_serialized_and_last_desired_set_wins', async () => {
    const pending = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const save = vi.fn((tagIds) => {
      const request = deferred();
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      pending.push({ tagIds, ...request });
      return request.promise.finally(() => { inFlight -= 1; });
    });
    const onChange = vi.fn();
    const queue = createTagAssignmentQueue({ initialTagIds: [1], save, onChange, onError: vi.fn() });

    queue.toggle(2);
    queue.toggle(3);
    queue.toggle(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(pending[0].tagIds).toEqual([1, 2]);

    pending[0].resolve();
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(2);
    expect(pending[1].tagIds).toEqual([2, 3]);
    expect(maxInFlight).toBe(1);

    pending[1].resolve();
    await flushPromises();
    expect(queue.getTagIds()).toEqual([2, 3]);
    expect(onChange).toHaveBeenLastCalledWith([2, 3]);
    expect(maxInFlight).toBe(1);
  });

  it('test_failed_tag_save_restores_last_confirmed_set_and_stops_queue', async () => {
    const firstRequest = deferred();
    const onChange = vi.fn();
    const onError = vi.fn();
    const save = vi.fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValueOnce(undefined);
    const queue = createTagAssignmentQueue({ initialTagIds: [1], save, onChange, onError });
    const failure = new Error('Could not save tags');

    queue.toggle(2);
    queue.toggle(3);
    firstRequest.reject(failure);
    await flushPromises();

    expect(queue.getTagIds()).toEqual([1]);
    expect(onChange).toHaveBeenLastCalledWith([1]);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(save).toHaveBeenCalledTimes(1);

    queue.toggle(4);
    await flushPromises();
    expect(save).toHaveBeenNthCalledWith(2, [1, 4]);
    expect(queue.getTagIds()).toEqual([1, 4]);
  });

  it('atomically replaces the complete desired set rather than saving invalid intermediate tag combinations', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = createTagAssignmentQueue({ initialTagIds: [1, 8], save });

    expect(queue.replace).toBeTypeOf('function');
    queue.replace([2]);
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([2]);
    expect(queue.getTagIds()).toEqual([2]);
  });
});
