import { useState, useEffect } from 'react';
import Login from './components/Login.jsx';
import MapView from './components/MapView.jsx';
import { socket } from './socket.js';

export default function App() {
  const [user, setUser] = useState(null); // { username, slot }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.username) setUser(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    socket.connect();
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST', credentials: 'include' });
    socket.disconnect();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'var(--font-headline)', fontSize: 24, color: 'var(--text-secondary)' }}>
          불러오는 중...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <MapView user={user} onLogout={handleLogout} />;
}
