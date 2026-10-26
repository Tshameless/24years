export type GrowthStandardMetric = 'weightKg' | 'heightCm' | 'headCircumferenceCm';
export type GrowthSex = 'boy' | 'girl';

export interface LmsPoint {
  ageMonths: number;
  l: number;
  m: number;
  s: number;
}

export const WHO_STANDARD_VERSION = 'WHO-0-5-derived-v1';
export const WHO_STANDARD_SOURCE =
  'WHO Child Growth Standards 0-5 years; parameter snapshot requires clinical review before production use.';

type PercentilePoint = [number, number, number];

const base: Record<GrowthSex, Record<GrowthStandardMetric, Record<number, PercentilePoint>>> = {
  boy: {
    weightKg: {
      0: [2.5, 3.3, 4.3], 1: [3.4, 4.5, 5.7], 2: [4.4, 5.6, 7], 3: [5.1, 6.4, 7.9],
      4: [5.6, 7, 8.6], 6: [6.4, 7.9, 9.7], 9: [7.2, 8.9, 10.9], 12: [7.8, 9.6, 11.8],
      18: [8.9, 10.9, 13.5], 24: [9.7, 12.2, 15], 36: [11.8, 14.3, 17.5], 48: [14, 16.3, 20],
      60: [15.8, 18.3, 22.7],
    },
    heightCm: {
      0: [46.3, 49.9, 53.4], 1: [51.1, 54.7, 58.4], 2: [54.7, 58.4, 62.2], 3: [57.6, 61.4, 65.3],
      4: [60, 63.9, 67.8], 6: [63.6, 67.6, 71.6], 9: [68, 72, 76.2], 12: [71.3, 75.7, 80.2],
      18: [77.2, 82.3, 87.4], 24: [82.5, 87.8, 93.2], 36: [91.2, 96.1, 101.2],
      48: [99.8, 103.3, 107.2], 60: [106.4, 110, 114],
    },
    headCircumferenceCm: {
      0: [32.1, 34.5, 36.9], 1: [35.1, 37.3, 39.5], 2: [37, 39.1, 41.2], 3: [38.3, 40.5, 42.6],
      4: [39.4, 41.6, 43.7], 6: [41, 43.3, 45.4], 9: [42.6, 45, 47.1], 12: [43.6, 46.1, 48.3],
      18: [44.9, 47.4, 49.7], 24: [45.8, 48.3, 50.7], 36: [47, 49.4, 51.8], 48: [48, 50.3, 52.6],
      60: [48.7, 51, 53.3],
    },
  },
  girl: {
    weightKg: {
      0: [2.4, 3.2, 4.2], 1: [3.2, 4.2, 5.4], 2: [4, 5.1, 6.5], 3: [4.6, 5.8, 7.4],
      4: [5.1, 6.4, 8.1], 6: [5.8, 7.3, 9.2], 9: [6.6, 8.2, 10.4], 12: [7.1, 8.9, 11.3],
      18: [8.2, 10.2, 12.8], 24: [9, 11.5, 14.4], 36: [11, 13.9, 17.2], 48: [13.2, 16.1, 19.8],
      60: [15, 18.2, 22.5],
    },
    heightCm: {
      0: [45.6, 49.1, 52.7], 1: [50, 53.7, 57.4], 2: [53.2, 57.1, 60.9], 3: [55.8, 59.8, 63.8],
      4: [58, 62.1, 66.2], 6: [61.5, 65.7, 69.8], 9: [65.6, 70.1, 74.5], 12: [69.2, 74, 78.9],
      18: [75.3, 80.7, 86.1], 24: [80.3, 86.4, 92.5], 36: [89.2, 95.1, 100.5],
      48: [97.8, 102.7, 107], 60: [104.7, 109.4, 114],
    },
    headCircumferenceCm: {
      0: [31.7, 33.9, 36.1], 1: [34.3, 36.5, 38.6], 2: [36, 38.2, 40.3], 3: [37.2, 39.5, 41.6],
      4: [38.3, 40.6, 42.7], 6: [39.9, 42.2, 44.4], 9: [41.5, 43.8, 46], 12: [42.5, 44.9, 47.1],
      18: [43.7, 46.2, 48.5], 24: [44.6, 47.2, 49.5], 36: [45.8, 48.3, 50.7], 48: [46.8, 49.2, 51.6],
      60: [47.6, 50, 52.4],
    },
  },
};

function toLms(points: PercentilePoint): LmsPoint {
  const [p3, p50, p97] = points;

  return { ageMonths: 0, l: 1, m: p50, s: (p97 - p3) / (3.7616 * p50) };
}

export function lmsFor(
  sex: GrowthSex,
  metric: GrowthStandardMetric,
  ageMonths: number,
): LmsPoint | null {
  if (ageMonths < 0 || ageMonths > 60) {return null;}

  const points = base[sex][metric];
  const ages = Object.keys(points).map(Number).sort((a, b) => a - b);
  const upper = ages.find((age) => age >= ageMonths) ?? ages[ages.length - 1];
  const lower = [...ages].reverse().find((age) => age <= ageMonths) ?? ages[0];

  if (lower === upper) {return { ...toLms(points[lower]), ageMonths };}

  const factor = (ageMonths - lower) / (upper - lower);
  const a = toLms(points[lower]);
  const b = toLms(points[upper]);

  return {
    ageMonths,
    l: 1,
    m: a.m + (b.m - a.m) * factor,
    s: a.s + (b.s - a.s) * factor,
  };
}
