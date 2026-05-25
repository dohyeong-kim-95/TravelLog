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
  if (!row || (!row.user1 && !row.user2)) return '#94A3B8';
  if (row.user1 && row.user2) return BOTH_COLOR;
  if (row.user1) return USER1_COLOR;
  return USER2_COLOR;
}

function getRevealedColor(row, userSlot) {
  if (!row) return userSlot === 1 ? USER1_FILL : USER2_FILL;
  const willBeUser1 = row.user1 || userSlot === 1;
  const willBeUser2 = row.user2 || userSlot === 2;
  if (willBeUser1 && willBeUser2) return BOTH_FILL;
  if (willBeUser1) return USER1_FILL;
  return USER2_FILL;
}

export default function KoreaMap({ visits, onCityClick, userSlot, photoMap }) {
  const wrapperRef = useRef(null);
  const [svgSize, setSvgSize]       = useState({ width: 500, height: 700 });
  const [tooltip, setTooltip]       = useState(null);
  const [hovered, setHovered]       = useState(null);
  const [scratching, setScratching] = useState(new Map());

  useEffect(() => {
    if (!wrapperRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSvgSize({ width, height });
    });
    obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, []);

  const { pathGen } = useMemo(() => {
    const proj = geoMercator().fitSize([svgSize.width, svgSize.height], koreaGeo);
    return { pathGen: geoPath(proj) };
  }, [svgSize]);

  const visitMap = useMemo(() => {
    const m = new Map();
    for (const v of visits) m.set(v.city_code, v);
    return m;
  }, [visits]);

  // 사진 패턴 (방문+사진 있는 도시만)
  const photoPatterns = useMemo(() => {
    if (!photoMap?.size) return [];
    return koreaGeo.features.flatMap(feature => {
      const { code } = feature.properties;
      const row = visitMap.get(code);
      if (!row?.user1 && !row?.user2) return [];
      const url = photoMap.get(code);
      if (!url) return [];
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
      return [{ code, url, x0, y0, w: x1 - x0, h: y1 - y0 }];
    });
  }, [visitMap, photoMap, pathGen]);

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
          {/* 스크래치 코팅 그라디언트 (은색/회색) */}
          <linearGradient id="scratchGrad" x1="0%" y1="0%" x2="100%" y2="100%"
                          gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#A8B2BE" />
            <stop offset="35%"  stopColor="#D4D9E0" />
            <stop offset="60%"  stopColor="#E8EAED" />
            <stop offset="100%" stopColor="#8E99A6" />
          </linearGradient>

          {/* 긁힘 reveal 필터 (애니메이션 중에만 사용) */}
          <filter id="scratchReveal" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.4 1.2"
                          numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise"
                               scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* 도시별 사진 패턴 */}
          {photoPatterns.map(({ code, url, x0, y0, w, h }) => (
            <pattern key={code} id={`photo-${code}`}
              patternUnits="userSpaceOnUse"
              x={x0} y={y0} width={w} height={h}>
              <image href={url} x={x0} y={y0} width={w} height={h}
                preserveAspectRatio="xMidYMid slice" />
            </pattern>
          ))}
        </defs>

        {/* 바다 배경 */}
        <rect x="0" y="0" width={svgSize.width} height={svgSize.height} fill="#A8D8EA" />

        <g>
          {koreaGeo.features.map((feature) => {
            const { code } = feature.properties;
            const row       = visitMap.get(code);
            const isVisited = !!(row?.user1 || row?.user2);
            const isHovered = hovered === code;
            const isScratch = scratching.has(code);
            const revColor  = scratching.get(code);
            const d         = pathGen(feature);
            const photoUrl  = photoMap?.get(code);

            const stroke      = getRevealedStroke(row);
            const strokeWidth = isHovered ? 1.5 : 0.6;

            // 방문+사진 → 사진, 방문+사진없음 → 색상, 미방문 → 스크래치
            const fill = isVisited
              ? (photoUrl ? `url(#photo-${code})` : (getRevealedFill(row) ?? USER1_FILL))
              : 'url(#scratchGrad)';

            return (
              <g key={code}>
                <path
                  d={d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleClick(feature)}
                  onMouseMove={e => handleMouseMove(e, feature)}
                  onMouseLeave={handleMouseLeave}
                />

                {/* 사진 위 연한 컬러 오버레이 */}
                {isVisited && photoUrl && (
                  <path
                    d={d}
                    fill={getRevealedFill(row) ?? 'transparent'}
                    opacity={0.22}
                    stroke="none"
                    pointerEvents="none"
                  />
                )}

                {/* 스크래치 긁기 애니메이션 */}
                {isScratch && (
                  <path
                    d={d}
                    fill="url(#scratchGrad)"
                    filter="url(#scratchReveal)"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    className={styles.scratching}
                    style={{ '--reveal': revColor, cursor: 'pointer', pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

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
              <span className={styles.notVisited}>탭해서 방문 표시하기 ✏️</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
