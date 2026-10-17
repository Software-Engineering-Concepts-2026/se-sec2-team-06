import { defineConfig } from 'vite';

export function createViteConfig(
  proxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
) {
  return {
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: false,
        },
      },
    },
  };
}

export default defineConfig(createViteConfig());
