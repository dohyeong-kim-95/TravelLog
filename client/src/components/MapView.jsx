import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import KoreaMap from './KoreaMap.jsx';
import styles from './MapView.module.css';

export default function MapView({ user }) {
  const [visits, setVisits]           = useState([]);
  const [onlineSlots, setOnlineSlots] = useState([]);
  const channelRef                    = useRef(null);

  // ── 초기 데이터 로드 ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('visits')
      .select('*')
      .then(({ data }) => { if (data) setVisits(data); });
  }, []);

  // ── Realtime 구독 (visits 변경 + presence) ────────────────────
  useEffect(() => {
    const channel = supabase.channel('map-room', {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    // DB 변경 → 방문 상태 업데이트
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'visits' },
      ({ new: row, eventType }) => {
        if (eventType === 'DELETE') return;
        setVisits(prev => {
          const idx = prev.findIndex(v => v.city_code === row.city_code);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = row;
            return next;
          }
          return [...prev, row];
        });
      }
    );

    // Presence → 누가 접속 중인지
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const slots = Object.values(state).flat().map(p => p.slot);
      setOnlineSlots([...new Set(slots)]);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ slot: user.slot, displayName: user.displayName });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [user.id, user.slot, user.displayName]);

  // ── 도시 토글 ─────────────────────────────────────────────────
  const handleToggle = useCallback(async ({ code, name, province }) => {
    const field   = `user${user.slot}`;
    const current = visits.find(v => v.city_code === code);
    const newVal  = !(current?.[field] ?? false);

    const newRow = {
      city_code:  code,
      city_name:  name,
      province,
      user1:      current?.user1 ?? false,
      user2:      current?.user2 ?? false,
      [field]:    newVal,
      updated_at: new Date().toISOString(),
    };

    // 낙관적 업데이트 (빠른 UI 반응)
    setVisits(prev => {
      const idx = prev.findIndex(v => v.city_code === code);
      if (idx >= 0) { const n = [...prev]; n[idx] = newRow; return n; }
      return [...prev, newRow];
    });

    const { error } = await supabase
      .from('visits')
      .upsert(newRow, { onConflict: 'city_code' });

    // 실패 시 롤백
    if (error) {
      setVisits(prev => {
        if (!current) return prev.filter(v => v.city_code !== code);
        const idx = prev.findIndex(v => v.city_code === code);
        if (idx < 0) return prev;
        const n = [...prev]; n[idx] = current; return n;
      });
    }
  }, [visits, user.slot]);

  // ── 로그아웃 ──────────────────────────────────────────────────
  const handleLogout = () => supabase.auth.signOut();

  // ── 통계 ──────────────────────────────────────────────────────
  const visitedByUser1 = visits.filter(v => v.user1).length;
  const visitedByUser2 = visits.filter(v => v.user2).length;
  const visitedByBoth  = visits.filter(v => v.user1 && v.user2).length;

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
            <OnlineDot slot={1} online={onlineSlots.includes(1)} color="var(--user1-color)" label="나" />
            <OnlineDot slot={2} online={onlineSlots.includes(2)} color="var(--user2-color)" label="여친" />
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>나가기</button>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        <aside className={styles.sidebar}>
          {/* 현재 사용자 */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>현재 접속</p>
            <div
              className={styles.userBadge}
              style={{
                background:   user.slot === 1 ? 'var(--user1-fill)' : 'var(--user2-fill)',
                borderColor:  user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
                color:        user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
              }}
            >
              {user.slot === 1 ? '💙' : '💗'} {user.displayName}
            </div>
          </div>

          {/* 범례 */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>범례</p>
            <div className={styles.legend}>
              <LegendItem color="var(--user1-color)" fill="var(--user1-fill)" label="나 방문"    count={visitedByUser1} />
              <LegendItem color="var(--user2-color)" fill="var(--user2-fill)" label="여친 방문"  count={visitedByUser2} />
              <LegendItem color="var(--both-color)"  fill="var(--both-fill)"  label="함께 방문"  count={visitedByBoth}  />
            </div>
          </div>

          {/* 통계 */}
          <div className={styles.card}>
            <p className={styles.cardLabel}>여행 통계</p>
            <div className={styles.stats}>
              <StatRow icon="💙" label="내가 가본 곳"   value={visitedByUser1} color="var(--user1-color)" />
              <StatRow icon="💗" label="여친이 가본 곳" value={visitedByUser2} color="var(--user2-color)" />
              <StatRow icon="💜" label="함께 가본 곳"   value={visitedByBoth}  color="var(--both-color)"  />
              <div className={styles.divider} />
              <StatRow icon="🗺️" label="전체 지역 수"  value={162}            color="var(--text-secondary)" />
            </div>
          </div>

          {/* 도움말 */}
          <div className={`${styles.card} ${styles.helpCard}`}>
            <p className={styles.cardLabel}>사용법</p>
            <p className={styles.helpText}>
              지도에서 가본 지역을 클릭하면 색칠됩니다. 다시 클릭하면 취소됩니다.
              두 명이 동시에 접속해서 실시간으로 함께 색칠할 수 있어요! ✨
            </p>
          </div>
        </aside>

        <section className={styles.mapSection}>
          <KoreaMap visits={visits} onToggle={handleToggle} userSlot={user.slot} />
        </section>
      </main>
    </div>
  );
}

function OnlineDot({ online, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        className={`${styles.statusDot} ${online ? styles.online : styles.offline}`}
        style={online ? { '--glow': color } : {}}
      />
      <span className={styles.statusLabel} style={{ color }}>{label}</span>
    </div>
  );
}

function LegendItem({ color, fill, label, count }) {
  return (
    <div className={styles.legendItem}>
      <span className={styles.legendSwatch} style={{ background: fill, border: `2px solid ${color}` }} />
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
