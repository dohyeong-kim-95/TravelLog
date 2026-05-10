import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import koreaGeo from '../data/korea.json';
import styles from './KoreaMap.module.css';

// City state → fill color
function getCityFill(row) {
  if (!row) return '#F3F4F6';
  if (row.user1 && row.user2) return 'var(--both-fill)';
  if (row.user1) return 'var(--user1-fill)';
  if (row.user2) return 'var(--user2-fill)';
  return '#F3F4F6';
}

function getCityStroke(row) {
  if (!row) return '#D1D5DB';
  if (row.user1 && row.user2) return 'var(--both-color)';
  if (row.user1) return 'var(--user1-color)';
  if (row.user2) return 'var(--user2-color)';
  return '#D1D5DB';
}

export default function KoreaMap({ visits, onToggle, userSlot }) {
  const svgRef = useRef(null);
  const [svgSize, setSvgSize] = useState({ width: 500, height: 700 });
  const [tooltip, setTooltip] = useState(null); // { name, x, y }
  const [hovered, setHovered] = useState(null);

  // Responsive SVG size
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setSvgSize({ width, height });
      }
    });
    observer.observe(svgRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  const { projection, pathGenerator } = useMemo(() => {
    const proj = geoMercator().fitSize(
      [svgSize.width, svgSize.height],
      koreaGeo
    );
    return { projection: proj, pathGenerator: geoPath(proj) };
  }, [svgSize]);

  const visitMap = useMemo(() => {
    const m = new Map();
    for (const v of visits) m.set(v.city_code, v);
    return m;
  }, [visits]);

  const handleClick = useCallback((feature) => {
    const { code, name, province } = feature.properties;
    onToggle({ code, name, province });
  }, [onToggle]);

  const handleMouseMove = useCallback((e, feature) => {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
    const row = visitMap.get(feature.properties.code);
    setTooltip({
      name: feature.properties.name,
      province: feature.properties.province,
      user1: row?.user1 || 0,
      user2: row?.user2 || 0,
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
    <div className={styles.mapWrapper}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}>
        <g>
          {koreaGeo.features.map((feature) => {
            const code = feature.properties.code;
            const row = visitMap.get(code);
            const isHovered = hovered === code;

            return (
              <path
                key={code}
                d={pathGenerator(feature)}
                fill={getCityFill(row)}
                stroke={getCityStroke(row)}
                strokeWidth={isHovered ? 2 : 0.8}
                className={styles.region}
                onClick={() => handleClick(feature)}
                onMouseMove={(e) => handleMouseMove(e, feature)}
                onMouseLeave={handleMouseLeave}
                style={{
                  filter: isHovered ? 'brightness(0.93)' : undefined,
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </g>
      </svg>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
        >
          <div className={styles.tooltipName}>{tooltip.name}</div>
          <div className={styles.tooltipSub}>{tooltip.province}</div>
          <div className={styles.tooltipVisits}>
            {tooltip.user1 && <span className={styles.dot1} />}
            {tooltip.user2 && <span className={styles.dot2} />}
            {!tooltip.user1 && !tooltip.user2 && (
              <span className={styles.notVisited}>아직 미방문</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
