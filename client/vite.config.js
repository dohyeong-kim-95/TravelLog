import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Supabase를 직접 사용하므로 proxy 불필요
});
