import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import KoreaMap from './KoreaMap.jsx';
import CityModal from './CityModal.jsx';
import styles from './MapView.module.css';

export default function MapView({ user, onLogout }) {
  const [visits, setVisits]             = useState([]);
  const [photos, setPhotos]             = useState([]);
  const [onlineSlots, setOnlineSlots]   = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showPanel, setShowPanel]       = useState(false);

  useEffect(() => {
    supabase.from('visits').select('*').then(({ data }) => { if (data) setVisits(data); });
    supabase.from('photos').select('*').then(({ data }) => { if (data) setPhotos(data); });
  }, []);

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
        ({ new: row }) => setPhotos(prev => [...prev, row]))
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

  const handleToggle = useCallback(async (code, name, province) => {
    const field   = `user${user.slot}`;
    const current = visits.find(v => v.city_code === code);
    const newVal  = !(current?.[field] ?? false);
    const newRow  = {
      city_code: code, city_name: name, province,
      user1: current?.user1 ?? false,
      user2: current?.user2 ?? false,
      [field]: newVal,
      updated_at: new Date().toISOString(),
    };
    setVisits(prev => {
      const idx = prev.findIndex(v => v.city_code === code);
      if (idx >= 0) { const n = [...prev]; n[idx] = newRow; return n; }
      return [...prev, newRow];
    });
    const { error } = await supabase.from('visits').upsert(newRow, { onConflict: 'city_code' });
    if (error) {
      setVisits(prev => {
        if (!current) return prev.filter(v => v.city_code !== code);
        const idx = prev.findIndex(v => v.city_code === code);
        if (idx < 0) return prev;
        const n = [...prev]; n[idx] = current; return n;
      });
    }
  }, [visits, user.slot]);

  const handleCityClick   = useCallback((props) => setSelectedCity(props), []);
  const handleModalToggle = useCallback(() => {
    if (selectedCity) handleToggle(selectedCity.code, selectedCity.name, selectedCity.province);
  }, [selectedCity, handleToggle]);
  const handleLogout = () => { onLogout?.(); supabase.auth.signOut(); };

  const visitedByBoth = visits.filter(v => v.user1 && v.user2).length;
  const totalVisited  = visits.filter(v => v.user1 || v.user2).length;

  const photoCodes = useMemo(() => new Set(photos.map(p => p.city_code)), [photos]);

  // 도시별 대표 사진 URL (가장 먼저 등록된 사진)
  const photoMap = useMemo(() => {
    const m = new Map();
    for (const p of photos) {
      if (!m.has(p.city_code)) {
        const url = supabase.storage.from('travel-photos').getPublicUrl(p.storage_path).data.publicUrl;
        m.set(p.city_code, url);
      }
    }
    return m;
  }, [photos]);

  const selectedVisitRow = useMemo(
    () => selectedCity ? visits.find(v => v.city_code === selectedCity.code) ?? null : null,
    [visits, selectedCity]);
  const selectedPhotos = useMemo(
    () => selectedCity ? photos.filter(p => p.city_code === selectedCity.code) : [],
    [photos, selectedCity]);

  const panelContent = (
    <>
      <div className={styles.panelSection}>
        <p className={styles.panelLabel}>현재 접속</p>
        <div className={styles.onlineBadges}>
          <OnlineBadge slot={1} online={onlineSlots.includes(1)} label="나" />
          <OnlineBadge slot={2} online={onlineSlots.includes(2)} label="여친" />
        </div>
      </div>

      <div className={styles.panelSection}>
        <p className={styles.panelLabel}>범례</p>
        <div className={styles.legend}>
          <LegendItem color="var(--user1-color)" fill="var(--user1-fill)" label="나 방문" />
          <LegendItem color="var(--user2-color)" fill="var(--user2-fill)" label="여친 방문" />
          <LegendItem color="var(--both-color)"  fill="var(--both-fill)"  label="함께 방문" />
          <LegendItem color="#6B7280" fill="#E5E8ED" label="아직 못 간 곳" />
        </div>
      </div>

      <div className={styles.panelSection}>
        <p className={styles.panelLabel}>여행 통계</p>
        <div className={styles.stats}>
          <StatRow icon="🗺️" label="가본 곳 (합계)" value={totalVisited}    color="var(--text-primary)"   />
          <StatRow icon="💜" label="함께 가본 곳"    value={visitedByBoth}   color="var(--both-color)"     />
          <div className={styles.divider} />
          <StatRow icon="📷" label="사진 있는 곳"    value={photoCodes.size} color="var(--color-tertiary)" />
        </div>
      </div>

      <div className={styles.helpCard}>
        <p className={styles.panelLabel}>사용법</p>
        <p className={styles.helpText}>지역을 탭하면 상세 창이 열려요. 방문 표시 후 사진을 올리면 스크래치가 긁혀 지도에 나타나요 📸</p>
      </div>
    </>
  );

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🗺️</span>
          <h1 className={styles.title}>우리 여행 지도</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.onlineRow}>
            <span className={`${styles.dot} ${onlineSlots.includes(1) ? styles.dotOn : styles.dotOff}`} />
            <span className={`${styles.dot} ${onlineSlots.includes(2) ? styles.dotOn2 : styles.dotOff}`} />
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>나가기</button>
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <p className={styles.panelLabel}>현재 접속</p>
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
          <div className={styles.sideCard}>{panelContent}</div>
        </aside>

        <section className={styles.mapSection}>
          <KoreaMap
            visits={visits}
            onCityClick={handleCityClick}
            userSlot={user.slot}
            photoMap={photoMap}
          />
        </section>
      </main>

      <div className={styles.mobileBar}>
        <div className={styles.mobileStats}>
          <span>🗺️ <strong>{totalVisited}</strong>곳 방문</span>
          <span style={{ color: 'var(--both-color)' }}>💜 함께 {visitedByBoth}곳</span>
        </div>
        <button className={styles.panelBtn} onClick={() => setShowPanel(true)}>
          📊 통계
        </button>
      </div>

      {showPanel && (
        <div className={styles.sheetBackdrop} onClick={() => setShowPanel(false)}>
          <div className={styles.bottomSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>통계 & 범례</span>
              <button className={styles.sheetClose} onClick={() => setShowPanel(false)}>✕</button>
            </div>
            <div className={styles.sheetContent}>{panelContent}</div>
          </div>
        </div>
      )}

      {selectedCity && (
        <CityModal
          city={selectedCity}
          visitRow={selectedVisitRow}
          photos={selectedPhotos}
          userSlot={user.slot}
          displayName={user.displayName}
          onToggleVisit={handleModalToggle}
          onPhotoUploaded={() => {}}
          onClose={() => setSelectedCity(null)}
        />
      )}
    </div>
  );
}

function OnlineBadge({ slot, online, label }) {
  const color = slot === 1 ? 'var(--user1-color)' : 'var(--user2-color)';
  const fill  = slot === 1 ? 'var(--user1-fill)'  : 'var(--user2-fill)';
  return (
    <div className={styles.onlineBadge} style={{ background: online ? fill : '#f3f4f6', borderColor: online ? color : 'var(--border-default)' }}>
      <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`}
            style={online ? { background: color, boxShadow: `0 0 0 3px ${color}33` } : {}} />
      <span style={{ color: online ? color : 'var(--text-secondary)', fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 12, color: online ? color : 'var(--text-secondary)' }}>{online ? '접속 중' : '오프라인'}</span>
    </div>
  );
}

function LegendItem({ color, fill, label }) {
  return (
    <div className={styles.legendItem}>
      <span className={styles.swatch} style={{ background: fill, border: `2px solid ${color}` }} />
      <span className={styles.legendLabel}>{label}</span>
    </div>
  );
}

function StatRow({ icon, label, value, color }) {
  return (
    <div className={styles.statRow}>
      <span>{icon}</span>
      <span className={styles.statLabel}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
