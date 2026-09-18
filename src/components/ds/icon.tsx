import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Maps the HotRocks design system's Lucide icon names to Ionicons, the
 * closest even-stroke outline set available without adding a new
 * dependency. Filled variants (rating stars) drop the "-outline" suffix.
 */
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  signal: 'cellular-outline',
  wifi: 'wifi-outline',
  'battery-full': 'battery-full-outline',
  flame: 'flame-outline',
  snowflake: 'snow-outline',
  timer: 'timer-outline',
  clock: 'time-outline',
  ban: 'ban-outline',
  'arrow-up': 'arrow-up',
  'arrow-down': 'arrow-down',
  user: 'person-outline',
  list: 'list-outline',
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  'chevron-down': 'chevron-down',
  plus: 'add',
  minus: 'remove',
  'map-pin': 'location-outline',
  star: 'star-outline',
  camera: 'camera-outline',
  image: 'image-outline',
  'cloud-off': 'cloud-offline-outline',
  pencil: 'pencil-outline',
  'trash-2': 'trash-outline',
  'share-2': 'share-social-outline',
  download: 'download-outline',
  'external-link': 'open-outline',
  settings: 'settings-outline',
  search: 'search-outline',
  check: 'checkmark',
  link: 'link-outline',
};

const FILLED_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  flame: 'flame',
  snowflake: 'snow',
  star: 'star',
  'map-pin': 'location',
};

export type IconName = keyof typeof ICON_MAP;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  fill?: boolean;
};

export function Icon({ name, size = 24, color, fill = false }: IconProps) {
  const glyph = (fill && FILLED_MAP[name]) || ICON_MAP[name] || 'help-circle-outline';
  return <Ionicons name={glyph} size={size} color={color ?? '#000000'} />;
}
