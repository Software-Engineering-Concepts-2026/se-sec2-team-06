import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/client.js', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '../src/api/client.js';
import { getSessionUser, loadSession } from '../src/auth/session.js';

describe('local session state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the signed-in user from the server session', async () => {
    const user = { id: 4, display_name: 'Learner' };
    getCurrentUser.mockResolvedValue(user);

    await expect(loadSession()).resolves.toEqual(user);
    expect(getSessionUser()).toEqual(user);
  });

  it('clears local session state when the server has no valid session', async () => {
    getCurrentUser.mockRejectedValue({ status: 401, message: 'unauthenticated' });

    await expect(loadSession()).resolves.toBeNull();
    expect(getSessionUser()).toBeNull();
  });
});
