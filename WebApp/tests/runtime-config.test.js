import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createViteConfig } from '../vite.config.js';

const originalTarget = process.env.VITE_API_PROXY_TARGET;

afterEach(() => {
  if (originalTarget === undefined) delete process.env.VITE_API_PROXY_TARGET;
  else process.env.VITE_API_PROXY_TARGET = originalTarget;
});

describe('Vite same-origin API proxy', () => {
  it('defaults to the local FastAPI service and preserves the browser host', () => {
    delete process.env.VITE_API_PROXY_TARGET;

    expect(createViteConfig().server.proxy['/api']).toMatchObject({
      target: 'http://127.0.0.1:8000',
      changeOrigin: false,
    });
  });

  it('uses the configured API proxy target when present', () => {
    process.env.VITE_API_PROXY_TARGET = 'http://localhost:9000';

    expect(createViteConfig().server.proxy['/api'].target).toBe('http://localhost:9000');
  });

  it('allows an explicit target override', () => {
    expect(createViteConfig('http://api.internal:8000').server.proxy['/api'].target)
      .toBe('http://api.internal:8000');
  });
});

describe('Compose Nginx same-origin API proxy', () => {
  it('preserves the browser host and port for FastAPI origin validation', () => {
    const nginxConfig = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');

    expect(nginxConfig).toContain('proxy_set_header Host $http_host;');
    expect(nginxConfig).not.toContain('proxy_set_header Host $host;');
  });
});
