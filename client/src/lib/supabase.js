import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 환경변수를 설정해주세요.');
}

export const supabase = createClient(url, key);
