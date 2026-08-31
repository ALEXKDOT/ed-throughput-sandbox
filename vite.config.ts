import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  const siteUrl = (
    process.env.VITE_SITE_URL ?? 'https://ALEXKDOT.github.io/ed-throughput-sandbox/'
  ).replace(/\/?$/u, '/');
  return {
    base: process.env.GITHUB_ACTIONS ? '/ed-throughput-sandbox/' : '/',
    plugins: [
      react(),
      {
        name: 'absolute-social-metadata',
        transformIndexHtml(html) {
          return html.replaceAll('__SITE_URL__', siteUrl);
        },
      },
    ],
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
      coverage: {
        reporter: ['text', 'html'],
        include: ['src/simulation/**/*.ts', 'src/utilities/**/*.ts'],
      },
    },
  };
});
