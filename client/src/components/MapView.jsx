import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import KoreaMap from './KoreaMap.jsx';
import CityModal from './CityModal.jsx';
import styles from './MapView.module.css';

export default function MapView({ user }) {
  const [visits, setVisits]           = useState([]);
  const [photos, setPhotos]           = useState([]);
  const [onlineSlots, setOnlineSlots] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null); // { code, name, province }

  // ── 초기 데이터 로드 ─────────────────────────────────────────
  useEffect(() => {
    supabase.from('visits').select('*').then(({ data }) => { if (data) setVisits(data); });
    supabase.from('photos').select('*').then(({ data }) => { if (data) setPhotos(data); });
  }, []);

  // ── Realtime 구독 ─────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel('map-room', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' },
        ({ new: row, eventType }) => {
          if (eventType === 'DELETE') return;
          setVisits(prev => {
            const idx = prev.findIndex(v => v.city_code === row.city_code);
            if (idx >= 0) { const n = [...prev]; n[idx] = row; return n; }
            return [...prev, row];
          });
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' },
        ({ new: row }) => {
          setPhotos(prev => [...prev, row]);
        })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineSlots([...new Set(Object.values(state).flat().map(p => p.slot))]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ slot: user.slot, displayName: user.displayName });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user.id, user.slot, user.displayName]);

  // ── 도시 색칠 토글 ────────────────────────────────────────────
  const handleToggle = useCallback(async (code, name, province) => {
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

    setVisits(prev => {
      const idx = prev.findIndex(v => v.city_code === code);
      if (idx >= 0) { const n = [...prev]; n[idx] = newRow; return n; }
      return [...prev, newRow];
    });

    const { error } = await supabase
      .from('visits')
      .upsert(newRow, { onConflict: 'city_code' });

    if (error) {
      setVisits(prev => {
        if (!current) return prev.filter(v => v.city_code !== code);
        const idx = prev.findIndex(v => v.city_code === code);
        if (idx < 0) return prev;
        const n = [...prev]; n[idx] = current; return n;
      });
    }
  }, [visits, user.slot]);

  // ── 지도 도시 클릭 → 모달 열기 ───────────────────────────────
  const handleCityClick = useCallback((cityProps) => {
    setSelectedCity(cityProps);
  }, []);

  // ── 모달 내 방문 토글 ─────────────────────────────────────────
  const handleModalToggle = useCallback(() => {
    if (!selectedCity) return;
    handleToggle(selectedCity.code, selectedCity.name, selectedCity.province);
  }, [selectedCity, handleToggle]);

  // ── 사진 업로드 완료 콜백 (realtime이 DB 반영 처리) ───────────
  const handlePhotoUploaded = useCallback(() => {}, []);

  // ── 로그아웃 ──────────────────────────────────────────────────
  const handleLogout = () => supabase.auth.signOut();

  // ── 파생 데이터 ───────────────────────────────────────────────
  const visitedByUser1 = visits.filter(v => v.user1).length;
  const visitedByUser2 = visits.filter(v => v.user2).length;
  const visitedByBoth  = visits.filter(v => v.user1 && v.user2).length;

  const photoCodes = useMemo(() => new Set(photos.map(p => p.city_code)), [photos]);

  const selectedVisitRow = useMemo(
    () => selectedCity ? visits.find(v => v.city_code === selectedCity.code) ?? null : null,
    [visits, selectedCity]
  );

  const selectedPhotos = useMemo(
    () => selectedCity ? photos.filter(p => p.city_code === selectedCity.code) : [],
    [photos, selectedCity]
  );

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
            <OnlineDot online={onlineSlots.includes(1)} color="var(--user1-color)" label="나" />
            <OnlineDot online={onlineSlots.includes(2)} color="var(--user2-color)" label="여친" />
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>나가기</button>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>현재 접속</p>
            <div
              className={styles.userBadge}
              style={{
                background:  user.slot === 1 ? 'var(--user1-fill)' : 'var(--user2-fill)',
                borderColor: user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
                color:       user.slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)',
              }}
            >
              {user.slot === 1 ? '💙' : '💗'} {user.displayName}
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>범례</p>
            <div className={styles.legend}>
              <LegendItem color="var(--user1-color)" fill="var(--user1-fill)" label="나 방문"   count={visitedByUser1} />
              <LegendItem color="var(--user2-color)" fill="var(--user2-fill)" label="여친 방문" count={visitedByUser2} />
              <LegendItem color="var(--both-color)"  fill="var(--both-fill)"  label="함께 방문" count={visitedByBoth}  />
              <LegendItem color="#C8930A" fill="#FEF3C7" label="미방문 (금박)" count={162 - visits.filter(v=>v.user1||v.user2).length} />
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>여행 통계</p>
            <div className={styles.stats}>
              <StatRow icon="💙" label="내가 가본 곳"   value={visitedByUser1} color="var(--user1-color)" />
              <StatRow icon="💗" label="여친이 가본 곳" value={visitedByUser2} color="var(--user2-color)" />
              <StatRow icon="💜" label="함께 가본 곳"   value={visitedByBoth}  color="var(--both-color)"  />
              <div className={styles.divider} />
              <StatRow icon="📷" label="사진 있는 곳"   value={photoCodes.size} color="var(--color-tertiary)" />
            </div>
          </div>

          <div className={`${styles.card} ${styles.helpCard}`}>
            <p className={styles.cardLabel}>사용법</p>
            <p className={styles.helpText}>
              지역을 클릭하면 상세 창이 열려요.<br />
              방문 표시를 하면 금박이 긁혀 색상이 드러나요! ✨<br />
              사진도 함께 추가할 수 있어요 📸
            </p>
          </div>
        </aside>

        <section className={styles.mapSection}>
          <KoreaMap
            visits={visits}
            onCityClick={handleCityClick}
            userSlot={user.slot}
            photoCodes={photoCodes}
          />
        </section>
      </main>

      {/* 도시 상세 모달 */}
      {selectedCity && (
        <CityModal
          city={selectedCity}
          visitRow={selectedVisitRow}
          photos={selectedPhotos}
          userSlot={user.slot}
          displayName={user.displayName}
          onToggleVisit={handleModalToggle}
          onPhotoUploaded={handlePhotoUploaded}
          onClose={() => setSelectedCity(null)}
        />
      )}
    </div>
  );
}

function OnlineDot({ online, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className={`${styles.statusDot} ${online ? styles.online : styles.offline}`} />
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
