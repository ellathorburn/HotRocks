import type { RoundSegment } from '@/components/ds';
import type { HeatmapDay } from '@/components/ds/heatmap';

/**
 * Design fixtures retained for profile statistics and preview-only screens.
 * Session list and detail screens use the live Expo SQLite store.
 */
export type SampleSession = {
  id: string;
  venue: string;
  totalTime: string;
  rounds: number;
  date: string;
  rating: number | null;
  synced: boolean;
  heat: string;
  cold: string;
  peak: number | null;
  coldTemp: number;
  note?: string;
  segments: RoundSegment[];
};

export const SESSIONS: SampleSession[] = [
  {
    id: 's1',
    venue: 'Löyly Kallio',
    totalTime: '48:20',
    rounds: 3,
    date: 'Tuesday, 06:40',
    rating: 4,
    synced: true,
    heat: '37 min',
    cold: '6 min',
    peak: 92,
    coldTemp: 11,
    note: 'Dark outside, empty sauna. Third round was the good one.',
    segments: [
      { type: 'heat', minutes: 15, temp: 92 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 12, temp: 90 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 10, temp: 88 },
      { type: 'cold', minutes: 2, temp: 11 },
    ],
  },
  {
    id: 's2',
    venue: 'Sea Point Pavilion',
    totalTime: '9:40',
    rounds: 1,
    date: 'Sunday, 08:05',
    rating: 5,
    synced: true,
    heat: '0 min',
    cold: '9:40',
    peak: null,
    coldTemp: 15,
    note: 'Tidal pool, no sauna. Worth it before work.',
    segments: [{ type: 'cold', minutes: 9.7, temp: 15 }],
  },
  {
    id: 's3',
    venue: 'Kotiharjun Sauna',
    totalTime: '1:04:10',
    rounds: 4,
    date: 'Friday, 18:20',
    rating: 4,
    synced: true,
    heat: '52 min',
    cold: '8 min',
    peak: 98,
    coldTemp: 12,
    segments: [
      { type: 'heat', minutes: 14, temp: 98 },
      { type: 'cold', minutes: 2, temp: 12 },
      { type: 'heat', minutes: 13, temp: 96 },
      { type: 'cold', minutes: 2, temp: 12 },
      { type: 'heat', minutes: 13, temp: 94 },
      { type: 'cold', minutes: 2, temp: 12 },
      { type: 'heat', minutes: 12, temp: 92 },
      { type: 'cold', minutes: 2, temp: 12 },
    ],
  },
  {
    id: 's4',
    venue: 'Allas Sea Pool Helsinki Waterfront',
    totalTime: '1:21:00',
    rounds: 6,
    date: 'Saturday, 07:15',
    rating: 5,
    synced: false,
    heat: '69 min',
    cold: '12 min',
    peak: 96,
    coldTemp: 11,
    note: 'Six rounds, longest session yet.',
    segments: [
      { type: 'heat', minutes: 14, temp: 96 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 13, temp: 94 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 12, temp: 92 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 11, temp: 90 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 10, temp: 88 },
      { type: 'cold', minutes: 2, temp: 11 },
      { type: 'heat', minutes: 9, temp: 86 },
      { type: 'cold', minutes: 2, temp: 11 },
    ],
  },
];

export const VENUES = [
  { name: 'Löyly Kallio', meta: 'Last used Tuesday' },
  { name: 'Sea Point Pavilion', meta: 'Cold only · Sunday' },
  { name: 'Kotiharjun Sauna', meta: '4 sessions' },
  { name: 'Home sauna', meta: '8 sessions' },
  { name: 'Allas Sea Pool Helsinki Waterfront', meta: '2 sessions' },
];

export const HEATMAP: HeatmapDay[] = Array.from({ length: 105 }, (_, i) => {
  const slot = (i * 7) % 13;
  if (slot > 4) return 0;
  const heat = [3, 2, 4, 1, 3][slot];
  if (i % 17 === 0) return { cold: heat };
  if (i % 4 === 0) return { heat, cold: ((i * 5) % 4) + 1 };
  return heat;
});

export function findSession(id: string): SampleSession | undefined {
  return SESSIONS.find((s) => s.id === id);
}
