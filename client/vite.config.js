import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: /TravelLog/
// 커스텀 도메인(travel.bubblelab.dev) 연결 후엔 '/' 로 변경
const base = process.env.BASE_PATH
  ? process.env.BASE_PATH.replace(/\/?$/, '/')   // trailing slash 보장
  : '/TravelLog/';

export default defineConfig({
  plugins: [react()],
  base,
});
