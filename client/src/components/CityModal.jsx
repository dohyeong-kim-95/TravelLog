import { useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import styles from './CityModal.module.css';

const USER1_COLOR = '#60A5FA';
const USER2_COLOR = '#F472B6';

export default function CityModal({
  city,          // { code, name, province }
  visitRow,      // row from visits table or null
  photos,        // photo rows for this city
  userSlot,      // 1 or 2
  displayName,
  onToggleVisit,
  onPhotoUploaded,
  onClose,
}) {
  const fileRef = useRef(null);

  const myField   = `user${userSlot}`;
  const otherSlot = userSlot === 1 ? 2 : 1;
  const myVisited    = visitRow?.[myField] ?? false;
  const otherVisited = visitRow?.[`user${otherSlot}`] ?? false;

  const myPhotos    = photos.filter(p => p.user_slot === userSlot);
  const otherPhotos = photos.filter(p => p.user_slot === otherSlot);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext  = file.name.split('.').pop();
    const path = `${userSlot}/${city.code}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('travel-photos')
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      alert('사진 업로드 실패: ' + uploadErr.message);
      return;
    }

    const { error: dbErr } = await supabase
      .from('photos')
      .insert({ city_code: city.code, city_name: city.name, user_slot: userSlot, storage_path: path });

    if (dbErr) {
      alert('사진 저장 실패: ' + dbErr.message);
    } else {
      onPhotoUploaded?.();
    }
  }, [city, userSlot, onPhotoUploaded]);

  const getPhotoUrl = (path) =>
    supabase.storage.from('travel-photos').getPublicUrl(path).data.publicUrl;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.cityName}>{city.name}</h2>
            <span className={styles.province}>{city.province}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {/* 방문 상태 */}
        <div className={styles.visitStatus}>
          <VisitBadge
            label={displayName}
            visited={myVisited}
            color={userSlot === 1 ? USER1_COLOR : USER2_COLOR}
            emoji={userSlot === 1 ? '💙' : '💗'}
          />
          <VisitBadge
            label={userSlot === 1 ? '여친' : '나'}
            visited={otherVisited}
            color={otherSlot === 1 ? USER1_COLOR : USER2_COLOR}
            emoji={otherSlot === 1 ? '💙' : '💗'}
          />
        </div>

        {/* 내 방문 토글 버튼 */}
        <button
          className={`${styles.visitBtn} ${myVisited ? styles.visitedBtn : styles.unvisitedBtn}`}
          onClick={onToggleVisit}
        >
          {myVisited ? '✅ 방문 취소하기' : '📍 방문 표시하기'}
        </button>

        {/* 사진 섹션 (내가 방문한 경우에만 업로드 가능) */}
        <div className={styles.photoSection}>
          <div className={styles.photoHeader}>
            <span className={styles.photoTitle}>📸 여행 사진</span>
            {myVisited && (
              <button
                className={styles.uploadBtn}
                onClick={() => fileRef.current?.click()}
              >
                + 사진 추가
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* 내 사진 */}
          {myPhotos.length > 0 && (
            <div className={styles.photoGroup}>
              <span className={styles.photoGroupLabel} style={{ color: userSlot === 1 ? USER1_COLOR : USER2_COLOR }}>
                {userSlot === 1 ? '💙' : '💗'} {displayName}
              </span>
              <div className={styles.photoGrid}>
                {myPhotos.map(p => (
                  <a key={p.id} href={getPhotoUrl(p.storage_path)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={getPhotoUrl(p.storage_path)}
                      alt={city.name}
                      className={styles.photo}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 상대방 사진 */}
          {otherPhotos.length > 0 && (
            <div className={styles.photoGroup}>
              <span className={styles.photoGroupLabel} style={{ color: otherSlot === 1 ? USER1_COLOR : USER2_COLOR }}>
                {otherSlot === 1 ? '💙' : '💗'} {userSlot === 1 ? '여친' : '나'}
              </span>
              <div className={styles.photoGrid}>
                {otherPhotos.map(p => (
                  <a key={p.id} href={getPhotoUrl(p.storage_path)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={getPhotoUrl(p.storage_path)}
                      alt={city.name}
                      className={styles.photo}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {photos.length === 0 && (
            <p className={styles.noPhotos}>
              {myVisited ? '사진을 추가해보세요 🌄' : '방문 표시 후 사진을 추가할 수 있어요'}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function VisitBadge({ label, visited, color, emoji }) {
  return (
    <div
      className={styles.visitBadge}
      style={{
        borderColor: visited ? color : 'var(--border-default)',
        background:  visited ? `${color}22` : '#f9f9f9',
        color:       visited ? color : 'var(--text-secondary)',
      }}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span style={{ fontSize: 12 }}>{visited ? '방문 ✓' : '미방문'}</span>
    </div>
  );
}
