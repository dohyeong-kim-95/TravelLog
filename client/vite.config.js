import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Actions configure-pages가 BASE_PATH를 주입, 커스텀 도메인 시 '/'
  base: process.env.BASE_PATH || '/',
});
