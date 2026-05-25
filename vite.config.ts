/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/floorplanner/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
