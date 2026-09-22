import { describe, expect, it, vi } from 'vitest';
import { ApiError, getApiHealth } from '../src/api/client.js';

describe('getApiHealth', () => {
  it('requests the same-origin health endpoint and returns the contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'healthy',
        service: 'synapsesync-api',
        architecture: 'modular-monolith',
        version: '0.1.0'
      })
    });

    await expect(getApiHealth({ fetchImpl })).resolves.toEqual({
      status: 'healthy',
      service: 'synapsesync-api',
      architecture: 'modular-monolith',
      version: '0.1.0'
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/health', { headers: { Accept: 'application/json' } });
  });

  it('turns a failed response into a safe ApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(getApiHealth({ fetchImpl })).rejects.toMatchObject({ status: 503 });
    await expect(getApiHealth({ fetchImpl })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a response that does not match the health contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'healthy' }) });
    await expect(getApiHealth({ fetchImpl })).rejects.toThrow('Invalid API health response');
  });
});
