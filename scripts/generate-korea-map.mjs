// Generates korea.json GeoJSON via Voronoi tessellation of municipality centroids
// Clips each cell to the South Korea coastline polygon

import { Delaunay } from 'd3-delaunay';
import * as turf from '@turf/turf';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const koreaOutlineRaw = require('@geo-maps/countries-coastline-1m/map.geo.json');

const koreaFeature = koreaOutlineRaw.features.find(f => f.properties?.A3 === 'KOR');
if (!koreaFeature) {
  console.error('Korea outline not found');
  process.exit(1);
}

// All South Korean 시/군/구 municipalities with approximate centroids
const municipalities = [
  // 서울특별시
  { code: '11', name: '서울특별시', province: '서울', lon: 126.978, lat: 37.566 },

  // 부산광역시
  { code: '26', name: '부산광역시', province: '부산', lon: 129.075, lat: 35.179 },

  // 대구광역시
  { code: '27', name: '대구광역시', province: '대구', lon: 128.601, lat: 35.871 },

  // 인천광역시
  { code: '28', name: '인천광역시', province: '인천', lon: 126.705, lat: 37.456 },

  // 광주광역시
  { code: '29', name: '광주광역시', province: '광주', lon: 126.851, lat: 35.160 },

  // 대전광역시
  { code: '30', name: '대전광역시', province: '대전', lon: 127.385, lat: 36.350 },

  // 울산광역시
  { code: '31', name: '울산광역시', province: '울산', lon: 129.312, lat: 35.540 },

  // 세종특별자치시
  { code: '36', name: '세종특별자치시', province: '세종', lon: 127.249, lat: 36.480 },

  // 경기도
  { code: '4111', name: '수원시', province: '경기', lon: 127.022, lat: 37.291 },
  { code: '4113', name: '성남시', province: '경기', lon: 127.137, lat: 37.419 },
  { code: '4115', name: '의정부시', province: '경기', lon: 127.034, lat: 37.741 },
  { code: '4117', name: '안양시', province: '경기', lon: 126.964, lat: 37.395 },
  { code: '4119', name: '부천시', province: '경기', lon: 126.783, lat: 37.503 },
  { code: '4121', name: '광명시', province: '경기', lon: 126.866, lat: 37.479 },
  { code: '4122', name: '평택시', province: '경기', lon: 127.112, lat: 37.000 },
  { code: '4123', name: '동두천시', province: '경기', lon: 127.060, lat: 37.903 },
  { code: '4125', name: '안산시', province: '경기', lon: 126.820, lat: 37.322 },
  { code: '4127', name: '고양시', province: '경기', lon: 126.832, lat: 37.658 },
  { code: '4128', name: '과천시', province: '경기', lon: 126.987, lat: 37.430 },
  { code: '4129', name: '구리시', province: '경기', lon: 127.140, lat: 37.594 },
  { code: '4131', name: '남양주시', province: '경기', lon: 127.216, lat: 37.636 },
  { code: '4133', name: '오산시', province: '경기', lon: 127.077, lat: 37.150 },
  { code: '4135', name: '시흥시', province: '경기', lon: 126.804, lat: 37.379 },
  { code: '4137', name: '군포시', province: '경기', lon: 126.937, lat: 37.362 },
  { code: '4139', name: '의왕시', province: '경기', lon: 126.966, lat: 37.345 },
  { code: '4141', name: '하남시', province: '경기', lon: 127.209, lat: 37.539 },
  { code: '4143', name: '용인시', province: '경기', lon: 127.202, lat: 37.241 },
  { code: '4145', name: '파주시', province: '경기', lon: 126.781, lat: 37.760 },
  { code: '4147', name: '이천시', province: '경기', lon: 127.435, lat: 37.272 },
  { code: '4150', name: '안성시', province: '경기', lon: 127.279, lat: 37.007 },
  { code: '4151', name: '김포시', province: '경기', lon: 126.716, lat: 37.619 },
  { code: '4153', name: '화성시', province: '경기', lon: 126.832, lat: 37.200 },
  { code: '4155', name: '광주시', province: '경기', lon: 127.254, lat: 37.429 },
  { code: '4157', name: '양주시', province: '경기', lon: 127.046, lat: 37.785 },
  { code: '4159', name: '포천시', province: '경기', lon: 127.200, lat: 37.900 },
  { code: '4161', name: '여주시', province: '경기', lon: 127.637, lat: 37.298 },
  { code: '4180', name: '가평군', province: '경기', lon: 127.512, lat: 37.832 },
  { code: '4182', name: '양평군', province: '경기', lon: 127.491, lat: 37.489 },
  { code: '4183', name: '연천군', province: '경기', lon: 127.076, lat: 38.094 },

  // 강원도 (강원특별자치도)
  { code: '5111', name: '춘천시', province: '강원', lon: 127.730, lat: 37.882 },
  { code: '5113', name: '원주시', province: '강원', lon: 127.945, lat: 37.342 },
  { code: '5115', name: '강릉시', province: '강원', lon: 128.876, lat: 37.751 },
  { code: '5117', name: '동해시', province: '강원', lon: 129.114, lat: 37.524 },
  { code: '5119', name: '태백시', province: '강원', lon: 128.987, lat: 37.164 },
  { code: '5121', name: '속초시', province: '강원', lon: 128.594, lat: 38.207 },
  { code: '5123', name: '삼척시', province: '강원', lon: 129.165, lat: 37.450 },
  { code: '5172', name: '홍천군', province: '강원', lon: 127.888, lat: 37.697 },
  { code: '5173', name: '횡성군', province: '강원', lon: 127.981, lat: 37.492 },
  { code: '5174', name: '영월군', province: '강원', lon: 128.461, lat: 37.181 },
  { code: '5175', name: '평창군', province: '강원', lon: 128.387, lat: 37.370 },
  { code: '5176', name: '정선군', province: '강원', lon: 128.659, lat: 37.380 },
  { code: '5177', name: '철원군', province: '강원', lon: 127.313, lat: 38.147 },
  { code: '5178', name: '화천군', province: '강원', lon: 127.709, lat: 38.107 },
  { code: '5179', name: '양구군', province: '강원', lon: 127.990, lat: 38.110 },
  { code: '5180', name: '인제군', province: '강원', lon: 128.170, lat: 38.069 },
  { code: '5181', name: '고성군', province: '강원', lon: 128.468, lat: 38.380 },
  { code: '5182', name: '양양군', province: '강원', lon: 128.619, lat: 38.075 },

  // 충청북도
  { code: '4311', name: '청주시', province: '충북', lon: 127.489, lat: 36.642 },
  { code: '4313', name: '충주시', province: '충북', lon: 127.925, lat: 36.991 },
  { code: '4315', name: '제천시', province: '충북', lon: 128.214, lat: 37.133 },
  { code: '4372', name: '보은군', province: '충북', lon: 127.729, lat: 36.489 },
  { code: '4373', name: '옥천군', province: '충북', lon: 127.571, lat: 36.301 },
  { code: '4374', name: '영동군', province: '충북', lon: 127.779, lat: 36.175 },
  { code: '4375', name: '증평군', province: '충북', lon: 127.582, lat: 36.786 },
  { code: '4376', name: '진천군', province: '충북', lon: 127.435, lat: 36.856 },
  { code: '4377', name: '괴산군', province: '충북', lon: 127.786, lat: 36.816 },
  { code: '4380', name: '음성군', province: '충북', lon: 127.687, lat: 36.939 },
  { code: '4382', name: '단양군', province: '충북', lon: 128.365, lat: 36.985 },

  // 충청남도
  { code: '4411', name: '천안시', province: '충남', lon: 127.153, lat: 36.806 },
  { code: '4413', name: '공주시', province: '충남', lon: 127.119, lat: 36.446 },
  { code: '4415', name: '보령시', province: '충남', lon: 126.612, lat: 36.333 },
  { code: '4417', name: '아산시', province: '충남', lon: 127.004, lat: 36.789 },
  { code: '4418', name: '서산시', province: '충남', lon: 126.452, lat: 36.784 },
  { code: '4420', name: '논산시', province: '충남', lon: 127.100, lat: 36.187 },
  { code: '4421', name: '계룡시', province: '충남', lon: 127.249, lat: 36.274 },
  { code: '4422', name: '당진시', province: '충남', lon: 126.626, lat: 36.890 },
  { code: '4471', name: '금산군', province: '충남', lon: 127.488, lat: 36.108 },
  { code: '4476', name: '부여군', province: '충남', lon: 126.909, lat: 36.275 },
  { code: '4477', name: '서천군', province: '충남', lon: 126.691, lat: 36.078 },
  { code: '4479', name: '청양군', province: '충남', lon: 126.802, lat: 36.459 },
  { code: '4480', name: '홍성군', province: '충남', lon: 126.660, lat: 36.601 },
  { code: '4481', name: '예산군', province: '충남', lon: 126.845, lat: 36.683 },
  { code: '4482', name: '태안군', province: '충남', lon: 126.266, lat: 36.745 },

  // 전라북도 (전북특별자치도)
  { code: '4511', name: '전주시', province: '전북', lon: 127.148, lat: 35.821 },
  { code: '4513', name: '군산시', province: '전북', lon: 126.736, lat: 35.967 },
  { code: '4514', name: '익산시', province: '전북', lon: 126.954, lat: 35.948 },
  { code: '4518', name: '정읍시', province: '전북', lon: 126.855, lat: 35.570 },
  { code: '4519', name: '남원시', province: '전북', lon: 127.390, lat: 35.416 },
  { code: '4521', name: '김제시', province: '전북', lon: 126.882, lat: 35.803 },
  { code: '4571', name: '완주군', province: '전북', lon: 127.162, lat: 35.905 },
  { code: '4572', name: '진안군', province: '전북', lon: 127.425, lat: 35.791 },
  { code: '4573', name: '무주군', province: '전북', lon: 127.661, lat: 35.910 },
  { code: '4574', name: '장수군', province: '전북', lon: 127.521, lat: 35.644 },
  { code: '4575', name: '임실군', province: '전북', lon: 127.289, lat: 35.617 },
  { code: '4577', name: '순창군', province: '전북', lon: 127.137, lat: 35.374 },
  { code: '4579', name: '고창군', province: '전북', lon: 126.702, lat: 35.436 },
  { code: '4580', name: '부안군', province: '전북', lon: 126.733, lat: 35.731 },

  // 전라남도
  { code: '4611', name: '목포시', province: '전남', lon: 126.388, lat: 34.812 },
  { code: '4613', name: '여수시', province: '전남', lon: 127.662, lat: 34.761 },
  { code: '4615', name: '순천시', province: '전남', lon: 127.487, lat: 34.950 },
  { code: '4617', name: '나주시', province: '전남', lon: 126.710, lat: 35.016 },
  { code: '4623', name: '광양시', province: '전남', lon: 127.695, lat: 34.943 },
  { code: '4671', name: '담양군', province: '전남', lon: 126.988, lat: 35.321 },
  { code: '4672', name: '곡성군', province: '전남', lon: 127.291, lat: 35.281 },
  { code: '4673', name: '구례군', province: '전남', lon: 127.463, lat: 35.202 },
  { code: '4677', name: '고흥군', province: '전남', lon: 127.277, lat: 34.607 },
  { code: '4678', name: '보성군', province: '전남', lon: 127.080, lat: 34.771 },
  { code: '4679', name: '화순군', province: '전남', lon: 126.987, lat: 35.064 },
  { code: '4680', name: '장흥군', province: '전남', lon: 126.907, lat: 34.683 },
  { code: '4681', name: '강진군', province: '전남', lon: 126.767, lat: 34.641 },
  { code: '4682', name: '해남군', province: '전남', lon: 126.599, lat: 34.574 },
  { code: '4683', name: '영암군', province: '전남', lon: 126.697, lat: 34.800 },
  { code: '4684', name: '무안군', province: '전남', lon: 126.481, lat: 34.990 },
  { code: '4686', name: '함평군', province: '전남', lon: 126.516, lat: 35.064 },
  { code: '4687', name: '영광군', province: '전남', lon: 126.512, lat: 35.277 },
  { code: '4688', name: '장성군', province: '전남', lon: 126.785, lat: 35.302 },
  { code: '4689', name: '완도군', province: '전남', lon: 126.754, lat: 34.312 },
  { code: '4690', name: '진도군', province: '전남', lon: 126.263, lat: 34.487 },
  { code: '4691', name: '신안군', province: '전남', lon: 126.107, lat: 34.830 },

  // 경상북도
  { code: '4711', name: '포항시', province: '경북', lon: 129.343, lat: 36.019 },
  { code: '4713', name: '경주시', province: '경북', lon: 129.211, lat: 35.856 },
  { code: '4715', name: '김천시', province: '경북', lon: 128.117, lat: 36.119 },
  { code: '4717', name: '안동시', province: '경북', lon: 128.724, lat: 36.566 },
  { code: '4719', name: '구미시', province: '경북', lon: 128.341, lat: 36.119 },
  { code: '4721', name: '영주시', province: '경북', lon: 128.624, lat: 36.807 },
  { code: '4723', name: '영천시', province: '경북', lon: 128.938, lat: 35.973 },
  { code: '4725', name: '상주시', province: '경북', lon: 128.161, lat: 36.411 },
  { code: '4728', name: '문경시', province: '경북', lon: 128.186, lat: 36.586 },
  { code: '4729', name: '경산시', province: '경북', lon: 128.741, lat: 35.825 },
  { code: '4772', name: '군위군', province: '경북', lon: 128.573, lat: 36.240 },
  { code: '4773', name: '의성군', province: '경북', lon: 128.697, lat: 36.352 },
  { code: '4775', name: '청송군', province: '경북', lon: 129.057, lat: 36.436 },
  { code: '4776', name: '영양군', province: '경북', lon: 129.112, lat: 36.667 },
  { code: '4777', name: '영덕군', province: '경북', lon: 129.365, lat: 36.415 },
  { code: '4782', name: '청도군', province: '경북', lon: 128.736, lat: 35.647 },
  { code: '4783', name: '고령군', province: '경북', lon: 128.263, lat: 35.726 },
  { code: '4784', name: '성주군', province: '경북', lon: 128.283, lat: 35.919 },
  { code: '4785', name: '칠곡군', province: '경북', lon: 128.401, lat: 35.995 },
  { code: '4790', name: '예천군', province: '경북', lon: 128.492, lat: 36.657 },
  { code: '4792', name: '봉화군', province: '경북', lon: 128.731, lat: 36.893 },
  { code: '4793', name: '울진군', province: '경북', lon: 129.403, lat: 36.993 },
  { code: '4794', name: '울릉군', province: '경북', lon: 130.905, lat: 37.479 },

  // 경상남도
  { code: '4811', name: '창원시', province: '경남', lon: 128.682, lat: 35.228 },
  { code: '4817', name: '진주시', province: '경남', lon: 128.107, lat: 35.180 },
  { code: '4819', name: '통영시', province: '경남', lon: 128.433, lat: 34.854 },
  { code: '4821', name: '사천시', province: '경남', lon: 128.063, lat: 34.937 },
  { code: '4822', name: '김해시', province: '경남', lon: 128.889, lat: 35.228 },
  { code: '4824', name: '밀양시', province: '경남', lon: 128.747, lat: 35.504 },
  { code: '4825', name: '거제시', province: '경남', lon: 128.621, lat: 34.880 },
  { code: '4827', name: '양산시', province: '경남', lon: 129.037, lat: 35.335 },
  { code: '4872', name: '의령군', province: '경남', lon: 128.262, lat: 35.322 },
  { code: '4873', name: '함안군', province: '경남', lon: 128.406, lat: 35.272 },
  { code: '4874', name: '창녕군', province: '경남', lon: 128.491, lat: 35.544 },
  { code: '4882', name: '고성군', province: '경남', lon: 128.323, lat: 34.974 },
  { code: '4884', name: '남해군', province: '경남', lon: 127.893, lat: 34.837 },
  { code: '4885', name: '하동군', province: '경남', lon: 127.751, lat: 35.066 },
  { code: '4886', name: '산청군', province: '경남', lon: 127.874, lat: 35.414 },
  { code: '4887', name: '함양군', province: '경남', lon: 127.726, lat: 35.520 },
  { code: '4888', name: '거창군', province: '경남', lon: 127.909, lat: 35.686 },
  { code: '4889', name: '합천군', province: '경남', lon: 128.165, lat: 35.566 },

  // 제주특별자치도
  { code: '5011', name: '제주시', province: '제주', lon: 126.531, lat: 33.500 },
  { code: '5013', name: '서귀포시', province: '제주', lon: 126.560, lat: 33.251 },
];

console.log(`Processing ${municipalities.length} municipalities...`);

// Korea bounding box with some padding (mainland + Jeju)
const bbox = [124.0, 32.5, 132.0, 38.7];

const points = municipalities.map(m => [m.lon, m.lat]);
const delaunay = Delaunay.from(points);
const voronoi = delaunay.voronoi(bbox);

const features = [];

for (let i = 0; i < municipalities.length; i++) {
  const m = municipalities[i];
  const cell = voronoi.cellPolygon(i);
  if (!cell) {
    console.warn(`No cell for ${m.name}`);
    continue;
  }

  // Close the polygon ring if needed
  const ring = [...cell];
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push(ring[0]);
  }

  const cellFeature = turf.polygon([ring.map(pt => [pt[0], pt[1]])], {});

  try {
    // Clip to Korea boundary
    const clipped = turf.intersect(
      turf.featureCollection([cellFeature, koreaFeature])
    );

    if (clipped && clipped.geometry) {
      clipped.id = m.code;
      clipped.properties = {
        name: m.name,
        code: m.code,
        province: m.province,
        centroid: [m.lon, m.lat],
      };
      features.push(clipped);
    } else {
      // Island municipalities (Ulleungdo, etc.) - keep original cell clipped to bbox
      const bboxPoly = turf.bboxPolygon(bbox);
      const fallback = turf.intersect(turf.featureCollection([cellFeature, bboxPoly]));
      if (fallback) {
        fallback.id = m.code;
        fallback.properties = {
          name: m.name,
          code: m.code,
          province: m.province,
          centroid: [m.lon, m.lat],
        };
        features.push(fallback);
        console.log(`Used fallback for: ${m.name}`);
      }
    }
  } catch (err) {
    console.warn(`Error clipping ${m.name}: ${err.message}`);
  }
}

const geojson = {
  type: 'FeatureCollection',
  features,
};

const outPath = path.resolve('client/src/data/korea.json');
fs.writeFileSync(outPath, JSON.stringify(geojson));
console.log(`\nGenerated ${features.length} features → ${outPath}`);
