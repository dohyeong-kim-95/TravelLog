import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import koreaGeo from '../data/korea.json';
import styles from './KoreaMap.module.css';

const USER1_COLOR = '#60A5FA';
const USER2_COLOR = '#F472B6';
const BOTH_COLOR  = '#A78BFA';
const USER1_FILL  = '#DBEAFE';
const USER2_FILL  = '#FCE7F3';
const BOTH_FILL   = '#EDE9FE';

function getRevealedFill(row) {
  if (!row || (!row.user1 && !row.user2)) return null;
  if (row.user1 && row.user2) return BOTH_FILL;
  if (row.user1) return USER1_FILL;
  return USER2_FILL;
}

function getRevealedStroke(row) {
  if (!row || (!row.user1 && !row.user2)) return '#9CA3AF';
  if (row.user1 && row.user2) return BOTH_COLOR;
  if (row.user1) return USER1_COLOR;
  return USER2_COLOR;
}

// CSS color string for scratch animation target
function getRevealedColor(row, userSlot) {
  if (!row) return userSlot === 1 ? USER1_FILL : USER2_FILL;
  const willBeUser1 = row.user1 || userSlot === 1;
  const willBeUser2 = row.user2 || userSlot === 2;
  if (willBeUser1 && willBeUser2) return BOTH_FILL;
  if (willBeUser1) return USER1_FILL;
  return USER2_FILL;
}

export default function KoreaMap({ visits, onCityClick, userSlot, photoCodes }) {
  const wrapperRef = useRef(null);
  const [svgSize, setSvgSize]         = useState({ width: 500, height: 700 });
  const [tooltip, setTooltip]         = useState(null);
  const [hovered, setHovered]         = useState(null);
  // city codes currently running scratch animation → their target color
  const [scratching, setScratching]   = useState(new Map());

  useEffect(() => {
    if (!wrapperRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSvgSize({ width, height });
    });
    obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, []);

  const { projection, pathGen } = useMemo(() => {
    const proj = geoMercator().fitSize([svgSize.width, svgSize.height], koreaGeo);
    return { projection: proj, pathGen: geoPath(proj) };
  }, [svgSize]);

  const visitMap = useMemo(() => {
    const m = new Map();
    for (const v of visits) m.set(v.city_code, v);
    return m;
  }, [visits]);

  const handleClick = useCallback((feature) => {
    const { code, name, province, centroid } = feature.properties;
    const row = visitMap.get(code);
    const field = `user${userSlot}`;
    const isMarkingVisited = !row?.[field];

    if (isMarkingVisited) {
      const color = getRevealedColor(row, userSlot);
      setScratching(prev => new Map(prev).set(code, color));
      setTimeout(() => {
        setScratching(prev => { const m = new Map(prev); m.delete(code); return m; });
      }, 700);
    }

    onCityClick({ code, name, province, centroid });
  }, [visitMap, userSlot, onCityClick]);

  const handleMouseMove = useCallback((e, feature) => {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
    const row = visitMap.get(feature.properties.code);
    setTooltip({
      name: feature.properties.name,
      province: feature.properties.province,
      user1: row?.user1 || false,
      user2: row?.user2 || false,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHovered(feature.properties.code);
  }, [visitMap]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHovered(null);
  }, []);

  return (
    <div className={styles.mapWrapper} ref={wrapperRef}>
      <svg width="100%" height="100%" viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}>
        <defs>
          {/* 스크래치 코팅 그라디언트 (은색/회색 - 물리적 스크래치 맵처럼) */}
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%"
                          gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#9CA3AF" />
            <stop offset="20%"  stopColor="#C8CDD6" />
            <stop offset="45%"  stopColor="#E5E8ED" />
            <stop offset="60%"  stopColor="#B8BFC9" />
            <stop offset="80%"  stopColor="#D0D5DE" />
            <stop offset="100%" stopColor="#8A9099" />
          </linearGradient>

          {/* 스크래치 질감 필터 */}
          <filter id="goldTexture" x="0%" y="0%" width="100%" height="100%"
                  colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.65 0.9"
                          numOctaves="3" seed="5" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
            <feBlend in="SourceGraphic" in2="gray" mode="overlay" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>

          {/* 긁힘 reveal 필터 (애니메이션 중) */}
          <filter id="scratchReveal" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.4 1.2"
                          numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise"
                               scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g>
          {koreaGeo.features.map((feature) => {
            const { code, centroid } = feature.properties;
            const row        = visitMap.get(code);
            const isVisited  = !!(row?.user1 || row?.user2);
            const isHovered  = hovered === code;
            const isScratch  = scratching.has(code);
            const revColor   = scratching.get(code);
            const d          = pathGen(feature);

            // 스크래치 하단 (이미 방문한 색상이 깔려있음)
            const baseFill   = getRevealedFill(row) ?? '#E5E8ED';
            const baseStroke = getRevealedStroke(row);

            // photo badge 위치
            let badgeX = 0, badgeY = 0;
            if (photoCodes?.has(code) && centroid) {
              const pt = projection(centroid);
              if (pt) { badgeX = pt[0]; badgeY = pt[1]; }
            }

            return (
              <g key={code}>
                {/* 하단 레이어: 방문 색상 */}
                <path
                  d={d}
                  fill={baseFill}
                  stroke={baseStroke}
                  strokeWidth={isHovered ? 1.8 : 0.7}
                  strokeLinejoin="round"
                />

                {/* 금박 오버레이 (미방문 시 불투명, 방문 시 투명) */}
                {!isScratch && (
                  <path
                    d={d}
                    fill={isVisited ? 'transparent' : 'url(#goldGradient)'}
                    filter={isVisited ? undefined : 'url(#goldTexture)'}
                    stroke={isVisited ? 'transparent' : (isHovered ? '#6B7280' : '#9CA3AF')}
                    strokeWidth={isHovered ? 1.8 : 0.7}
                    strokeLinejoin="round"
                    opacity={isVisited ? 0 : 1}
                    className={styles.goldLayer}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleClick(feature)}
                    onMouseMove={e => handleMouseMove(e, feature)}
                    onMouseLeave={handleMouseLeave}
                  />
                )}

                {/* 긁는 애니메이션 레이어 */}
                {isScratch && (
                  <path
                    d={d}
                    fill="url(#goldGradient)"
                    filter="url(#scratchReveal)"
                    stroke="#9CA3AF"
                    strokeWidth={0.7}
                    strokeLinejoin="round"
                    className={styles.scratching}
                    style={{ '--reveal': revColor, cursor: 'pointer' }}
                    onClick={() => handleClick(feature)}
                    onMouseMove={e => handleMouseMove(e, feature)}
                    onMouseLeave={handleMouseLeave}
                  />
                )}

                {/* 방문된 지역 클릭 핸들러 */}
                {isVisited && !isScratch && (
                  <path
                    d={d}
                    fill="transparent"
                    stroke="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleClick(feature)}
                    onMouseMove={e => handleMouseMove(e, feature)}
                    onMouseLeave={handleMouseLeave}
                  />
                )}

                {/* 사진 배지 */}
                {photoCodes?.has(code) && isVisited && badgeX > 0 && (
                  <text
                    x={badgeX}
                    y={badgeY}
                    fontSize={9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  >
                    📷
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 툴팁 */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}
        >
          <div className={styles.tooltipName}>{tooltip.name}</div>
          <div className={styles.tooltipSub}>{tooltip.province}</div>
          <div className={styles.tooltipVisits}>
            {tooltip.user1 && <span className={styles.dot} style={{ background: USER1_COLOR }} />}
            {tooltip.user2 && <span className={styles.dot} style={{ background: USER2_COLOR }} />}
            {!tooltip.user1 && !tooltip.user2 && (
              <span className={styles.notVisited}>클릭해서 색칠하기 ✏️</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
