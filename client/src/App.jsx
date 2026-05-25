import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import Login from './components/Login.jsx';
import MapView from './components/MapView.jsx';

const CREDS_KEY = 'travellog_auto';

export async function trySavedLogin() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const { email, password } = JSON.parse(raw);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      localStorage.removeItem(CREDS_KEY);
      return null;
    }
    return data.session;
  } catch {
    return null;
  }
}

export function saveCredentials(email, password) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password }));
}

export function clearCredentials() {
  localStorage.removeItem(CREDS_KEY);
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = 로딩 중

  useEffect(() => {
    const init = async () => {
      // 1) 기존 세션 복원
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        return;
      }
      // 2) 저장된 로그인 정보로 자동 로그인
      const saved = await trySavedLogin();
      setSession(saved); // null이면 로그인 화면 표시
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'var(--font-headline)', fontSize: 24, color: 'var(--text-secondary)' }}>
          불러오는 중...
        </p>
      </div>
    );
  }

  if (!session) return <Login onSaveCredentials={saveCredentials} />;

  const meta = session.user.user_metadata ?? {};
  const user = {
    id: session.user.id,
    email: session.user.email,
    slot: meta.slot ?? 1,
    displayName: meta.display_name ?? session.user.email,
  };

  return <MapView user={user} onLogout={clearCredentials} />;
}
