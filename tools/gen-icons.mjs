// Generuje src/ui/icon-data.js z ikon Lucide (licencja ISC) dostępnych lokalnie w react-icons.
import fs from 'node:fs';
const src = fs.readFileSync('/opt/npm-tools/node_modules/react-icons/lu/index.mjs', 'utf8');
const all = {};
for (const m of src.matchAll(/export function (Lu\w+) \(props\) \{\s*return GenIcon\((\{[\s\S]*?\})\)\(props\);/g)) { try { all[m[1]] = JSON.parse(m[2]); } catch {} }
const want = {
  pin: 'Pin', history: 'Landmark', community: 'MessagesSquare', map: 'Map', game: 'MapPinned', ticket: 'Ticket', menu: 'Menu', back: 'ChevronLeft', forward: 'ChevronRight', down: 'ChevronDown', up: 'ChevronUp',
  search: 'Search', close: 'X', heart: 'Heart', qr: 'QrCode', scan: 'ScanLine', bluetooth: 'Bluetooth', beacon: 'Radio', ar: 'Box', cube: 'Box', headphones: 'Headphones', play: 'Play', pause: 'Pause', stop: 'Square',
  settings: 'Settings', globe: 'Globe', contrast: 'Contrast', ear: 'Ear', calendar: 'Calendar', clock: 'Clock', info: 'Info', star: 'Star', leaf: 'Leaf', factory: 'Factory', people: 'Users', user: 'User', share: 'Share2',
  grid: 'LayoutGrid', list: 'List', check: 'Check', plus: 'Plus', minus: 'Minus', trash: 'Trash2', edit: 'Pencil', eye: 'Eye', eyeOff: 'EyeOff', upload: 'Upload', download: 'Download', wifi: 'Wifi', wifiOff: 'WifiOff', signal: 'Signal',
  logout: 'LogOut', login: 'LogIn', lock: 'Lock', cart: 'ShoppingCart', card: 'CreditCard', phone: 'Phone', mail: 'Mail', link: 'Link', mapPin: 'MapPin', route: 'Route', walk: 'Footprints', bike: 'Bike', wheelchair: 'Accessibility',
  trophy: 'Trophy', gift: 'Gift', coupon: 'TicketPercent', quiz: 'CircleHelp', camera: 'Camera', video: 'Video', image: 'Image', volume: 'Volume2', mute: 'VolumeX', mic: 'Mic', hand: 'Hand', captions: 'Captions', sun: 'Sun', moon: 'Moon',
  power: 'Power', refresh: 'RefreshCw', alert: 'TriangleAlert', bell: 'Bell', filter: 'ListFilter', arrowRight: 'ArrowRight', arrowLeft: 'ArrowLeft', external: 'ExternalLink', home: 'House', layers: 'Layers', monitor: 'Monitor',
  tablet: 'Tablet', smartphone: 'Smartphone', server: 'Server', speaker: 'Speaker', bulb: 'Lightbulb', chart: 'ChartColumn', shield: 'ShieldCheck', key: 'KeyRound', copy: 'Copy', printer: 'Printer', drag: 'GripVertical',
  sparkles: 'Sparkles', rotate: 'Rotate3d', panorama: 'Panorama', flag: 'Flag', target: 'Target', compass: 'Compass', tree: 'TreeDeciduous', book: 'BookOpen', send: 'Send', languages: 'Languages', building: 'Building2',
  utensils: 'Utensils', coffee: 'Coffee', music: 'Music', film: 'Film', news: 'Newspaper', tag: 'Tag', folder: 'Folder', file: 'FileText', database: 'Database', code: 'Braces', activity: 'Activity', thermometer: 'Thermometer',
  cpu: 'Cpu', wrench: 'Wrench', zap: 'Zap', cloud: 'Cloud', cloudRain: 'CloudRain', cloudSun: 'CloudSun', snow: 'Snowflake', wind: 'Wind', navigation: 'Navigation', locate: 'LocateFixed', zoomIn: 'ZoomIn', zoomOut: 'ZoomOut',
  maximize: 'Maximize2', minimize: 'Minimize2', more: 'Ellipsis', moreV: 'EllipsisVertical', undo: 'Undo2', save: 'Save', history2: 'History', timer: 'Timer', hourglass: 'Hourglass', award: 'Award', medal: 'Medal', puzzle: 'Puzzle',
  message: 'MessageSquare', thumbsUp: 'ThumbsUp', userCheck: 'UserCheck', userPlus: 'UserPlus', idCard: 'IdCard', receipt: 'Receipt', wallet: 'Wallet', banknote: 'Banknote', percent: 'Percent', package: 'Package', store: 'Store',
  doorOpen: 'DoorOpen', parking: 'CircleParking', toilet: 'Toilet', baby: 'Baby', dog: 'Dog', train: 'TrainFront', bus: 'Bus', car: 'Car', mountain: 'Mountain', waves: 'Waves', bird: 'Bird', flower: 'Flower2', sprout: 'Sprout', pickaxe: 'Pickaxe', hammer: 'Hammer', cog: 'Cog',
  phoneCall: 'PhoneCall', phoneOff: 'PhoneOff', videoOff: 'VideoOff', subtitles: 'Subtitles', accessibility: 'PersonStanding', rss: 'Rss', tv: 'Tv', playlist: 'ListVideo', toggle: 'ToggleRight', sliders: 'SlidersHorizontal', split: 'Columns2', terminal: 'SquareTerminal', help: 'LifeBuoy', circle: 'Circle', circleCheck: 'CircleCheck', circleX: 'CircleX', circleAlert: 'CircleAlert', skipForward: 'SkipForward', skipBack: 'SkipBack', repeat: 'Repeat', move: 'Move', pointer: 'Pointer', touch: 'Pointer', expand: 'Expand', bookmark: 'Bookmark', text: 'Type', bold: 'Bold', globe2: 'Earth', paperclip: 'Paperclip', glasses: 'Glasses', vibrate: 'Vibrate', battery: 'BatteryMedium', nfc: 'Nfc', satellite: 'Satellite', fingerprint: 'Fingerprint', smile: 'Smile',
};
const alt = { CircleHelp: ['HelpCircle', 'CircleQuestionMark'], TriangleAlert: ['AlertTriangle'], House: ['Home'], ChartColumn: ['BarChart3', 'ChartBar'], Ellipsis: ['MoreHorizontal'], EllipsisVertical: ['MoreVertical'], CircleCheck: ['CheckCircle2', 'CheckCircle'], CircleX: ['XCircle'], CircleAlert: ['AlertCircle'], CircleParking: ['ParkingCircle'], Columns2: ['Columns'], SquareTerminal: ['TerminalSquare'], ListFilter: ['Filter'], TrainFront: ['Train'], Earth: ['Globe2'], Captions: ['Subtitles'], Panorama: ['GalleryHorizontal', 'Image'], Rotate3d: ['Rotate3D', 'RotateCw'], TicketPercent: ['Ticket'], Flower2: ['Flower'], IdCard: ['Contact'], Toilet: ['Bath'], PersonStanding: ['Accessibility'] };
const out = {}; const missing = [];
const conv = (n) => [n.tag, n.attr];
for (const [alias, name] of Object.entries(want)) {
  const cand = ['Lu' + name, ...(alt[name] || []).map((a) => 'Lu' + a)]; const hit = cand.find((c) => all[c]);
  if (!hit) { missing.push(alias + '→' + name); continue; }
  out[alias] = all[hit].child.map(conv);
}
fs.writeFileSync(new URL('../src/ui/icon-data.js', import.meta.url), '// Wygenerowane przez tools/gen-icons.mjs – ikony Lucide (licencja ISC, https://lucide.dev). Nie edytować ręcznie.\nexport const ICONS = ' + JSON.stringify(out) + ';\n');
console.log('ikon:', Object.keys(out).length, 'brak:', missing.join(', ') || '—');
