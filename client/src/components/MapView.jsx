import { useState, useEffect, useCallback } from 'react';
import { socket } from '../socket.js';
import KoreaMap from './KoreaMap.jsx';
import styles from './MapView.module.css';

const USER_LABELS = { 1: null, 2: null }; // filled from env or server

export default function MapView({ user, onLogout }) {
  const [visits, setVisits] = useState([]);
  const [onlineSlots, setOnlineSlots] = useState([]);
  const [connected, setConnected] = useState(false);
  const [userNames, setUserNames] = useState({ 1: '나', 2: '여친' });

  // Fetch initial visit data
  useEffect(() => {
    fetch('/api/visits', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setVisits(data);
      });
  }, []);

  // Socket.io setup
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('city-updated', (updated) => {
      setVisits(prev => {
        const idx = prev.findIndex(v => v.city_code === updated.city_code);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });

    socket.on('users-online', (slots) => {
      setOnlineSlots(slots);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('city-updated');
      socket.off('users-online');
    };
  }, []);

  const handleToggle = useCallback(({ code, name, province }) => {
    socket.emit('toggle-city', { code, name, province });
  }, []);

  const visitedByUser1 = visits.filter(v => v.user1).length;
  const visitedByUser2 = visits.filter(v => v.user2).length;
  const visitedByBoth = visits.filter(v => v.user1 && v.user2).length;

  const slot1Name = user.slot === 1 ? user.username : (onlineSlots.includes(2) ? '파트너' : '여친');
  const slot2Name = user.slot === 2 ? user.username : (onlineSlots.includes(1) ? '파트너' : '나');

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🗺️</span>
          <h1 className={styles.title}>우리 여행 지도</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.onlineStatus}>
            <span
              className={`${styles.statusDot} ${onlineSlots.includes(1) ? styles.online : styles.offline}`}
            />
            <span className={styles.statusLabel} style={{ color: 'var(--user1-color)' }}>나</span>

            <span
              className={`${styles.statusDot} ${onlineSlots.includes(2) ? styles.online : styles.offline}`}
              style={{ '--dot-color': 'var(--user2-color)' }}
            />
            <span className={styles.statusLabel} style={{ color: 'var(--user2-color)' }}>여친</span>
          </div>

          <button className={styles.logoutBtn} onClick={onLogout}>
            나가기
          </button>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Current user badge */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>현재 접속</p>
            <div
              className={styles.userBadge}
              style={{
                background: user.slot === 1 ? 'var(--user1-fill)' : 'var(--user2-fill)',
                borderColor: user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
                color: user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
              }}
            >
              {user.slot === 1 ? '💙' : '💗'} {user.username}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>범례</p>
            <div className={styles.legend}>
              <LegendItem color="var(--user1-color)" fill="var(--user1-fill)" label="나 방문" count={visitedByUser1} />
              <LegendItem color="var(--user2-color)" fill="var(--user2-fill)" label="여친 방문" count={visitedByUser2} />
              <LegendItem color="var(--both-color)" fill="var(--both-fill)" label="함께 방문" count={visitedByBoth} />
            </div>
          </div>

          {/* Stats */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>여행 통계</p>
            <div className={styles.stats}>
              <StatRow
                icon="💙"
                label="내가 가본 곳"
                value={visitedByUser1}
                color="var(--user1-color)"
              />
              <StatRow
                icon="💗"
                label="여친이 가본 곳"
                value={visitedByUser2}
                color="var(--user2-color)"
              />
              <StatRow
                icon="💜"
                label="함께 가본 곳"
                value={visitedByBoth}
                color="var(--both-color)"
              />
              <div className={styles.divider} />
              <StatRow
                icon="🗺️"
                label="전체 지역 수"
                value={162}
                color="var(--text-secondary)"
              />
            </div>
          </div>

          {/* How to use */}
          <div className={`${styles.card} ${styles.helpCard}`}>
            <p className={styles.cardLabel}>사용법</p>
            <p className={styles.helpText}>지도에서 가본 지역을 클릭하면 색칠됩니다. 다시 클릭하면 취소됩니다. 두 명이 동시에 접속해서 실시간으로 함께 색칠할 수 있어요! ✨</p>
          </div>
        </aside>

        {/* Map */}
        <section className={styles.mapSection}>
          <KoreaMap
            visits={visits}
            onToggle={handleToggle}
            userSlot={user.slot}
          />
        </section>
      </main>
    </div>
  );
}

function LegendItem({ color, fill, label, count }) {
  return (
    <div className={styles.legendItem}>
      <span
        className={styles.legendSwatch}
        style={{ background: fill, border: `2px solid ${color}` }}
      />
      <span className={styles.legendLabel}>{label}</span>
      <span className={styles.legendCount} style={{ color }}>{count}곳</span>
    </div>
  );
}

function StatRow({ icon, label, value, color }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={{ color }}>{value}</span>
    </div>
  );
}
