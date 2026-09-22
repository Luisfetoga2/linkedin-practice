import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/linkedin-practice/ (GitHub Pages project site).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/linkedin-practice/',
  plugins: [react()],
  build: { target: 'es2020' },
  worker: { format: 'es' },
});
