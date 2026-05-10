import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import Login from './components/Login.jsx';
import MapView from './components/MapView.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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

  if (!session) return <Login />;

  const meta = session.user.user_metadata ?? {};
  const user = {
    id: session.user.id,
    email: session.user.email,
    slot: meta.slot ?? 1,
    displayName: meta.display_name ?? session.user.email,
  };

  return <MapView user={user} />;
}
