import { AppTheme, ThemeOption } from '../types/index.js';

const THEME_STORAGE_KEY = 'architect_os_theme';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    name: 'Nền Trắng Sáng (Pure White)',
    category: 'light',
    description: 'Nền trắng sứ tinh khôi, tương phản sắc nét, phong cách tối giản thanh lịch văn phòng.',
    tag: 'Tối Giản',
    bgHex: '#F8FAFC',
    cardHex: '#FFFFFF',
    borderHex: '#E2E8F0',
    accentHex: '#2563EB',
  },
  {
    id: 'light-blue',
    name: 'Nền Xanh Nhạt (Ice Blue Pastel)',
    category: 'light',
    description: 'Nền xanh băng mát dịu, làm dịu mắt trong điều kiện ánh sáng văn phòng, tràn đầy năng lượng tươi mới.',
    tag: 'Mát Dịu',
    bgHex: '#F0F6FF',
    cardHex: '#FFFFFF',
    borderHex: '#BFDBFE',
    accentHex: '#0284C7',
  },
  {
    id: 'light-pink',
    name: 'Nền Hồng Nhạt (Rose Pastel / Sakura)',
    category: 'light',
    description: 'Nền hồng phấn hoa anh đào dịu ngọt, thanh lịch, mang lại cảm giác ấm áp và thư giãn khi làm việc.',
    tag: 'Ngọt Ngào',
    bgHex: '#FFF1F2',
    cardHex: '#FFFFFF',
    borderHex: '#FECDD3',
    accentHex: '#E11D48',
  },
  {
    id: 'light-purple',
    name: 'Nền Tím Nhạt (Lavender / Lilac Pastel)',
    category: 'light',
    description: 'Nền hoa oải hương tím nhạt thơ mộng, nhẹ nhàng, khơi gợi cảm hứng sáng tạo và xua tan căng thẳng.',
    tag: 'Thơ Mộng',
    bgHex: '#F5F3FF',
    cardHex: '#FFFFFF',
    borderHex: '#DDD6FE',
    accentHex: '#7C3AED',
  },
  {
    id: 'dark',
    name: 'Nền Đen Sâu (Obsidian Dark)',
    category: 'dark',
    description: 'Tông đen sâu lắng huyền bí như hiện tại, chống mỏi mắt tối đa trong không gian tối.',
    tag: 'Tiêu Chuẩn',
    bgHex: '#181B20',
    cardHex: '#152033',
    borderHex: '#22334D',
    accentHex: '#D4AF37',
  },
  {
    id: 'dark-gray',
    name: 'Nền Xám Nhạt Hơn (Charcoal / Slate Gray)',
    category: 'dark',
    description: 'Tông xám khói than trung tính, sáng hơn nền đen, chống lóa và tạo chiều sâu êm ái khi đọc lâu.',
    tag: 'Dịu Mắt',
    bgHex: '#252B36',
    cardHex: '#2F3746',
    borderHex: '#424D5F',
    accentHex: '#60A5FA',
  },
  {
    id: 'dark-navy',
    name: 'Nền Xanh Đậm (Deep Ocean Navy)',
    category: 'dark',
    description: 'Tông xanh đại dương huyền thoại, phong cách điều hành doanh nghiệp và giám sát công nghệ chuyên sâu.',
    tag: 'Doanh Nhân',
    bgHex: '#0A192F',
    cardHex: '#10243E',
    borderHex: '#1E3E64',
    accentHex: '#38BDF8',
  },
];

const VALID_THEMES: AppTheme[] = [
  'light',
  'light-blue',
  'light-pink',
  'light-purple',
  'dark',
  'dark-gray',
  'dark-navy',
];

const THEME_CLASSES = [
  'theme-light-white',
  'theme-light-blue',
  'theme-light-pink',
  'theme-light-purple',
  'theme-dark-black',
  'theme-dark-gray',
  'theme-dark-navy',
];

/**
 * Get current persisted theme
 */
export function getSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme;
    if (VALID_THEMES.includes(saved)) {
      return saved;
    }
  } catch {}
  return 'light';
}

/**
 * Apply theme to document element and body
 */
export function applyTheme(theme: AppTheme): void {
  const safeTheme: AppTheme = VALID_THEMES.includes(theme) ? theme : 'light';

  try {
    localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
  } catch {}

  const root = document.documentElement;
  const body = document.body;

  // Clean previous custom theme classes
  THEME_CLASSES.forEach(cls => {
    root.classList.remove(cls);
    body.classList.remove(cls);
  });

  const isLight =
    safeTheme === 'light' ||
    safeTheme === 'light-blue' ||
    safeTheme === 'light-pink' ||
    safeTheme === 'light-purple';

  if (isLight) {
    root.classList.add('theme-light');
    root.classList.remove('dark');
    body.classList.add('theme-light');
    body.classList.remove('dark');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('theme-light');
    root.classList.add('dark');
    body.classList.remove('theme-light');
    body.classList.add('dark');
    root.style.colorScheme = 'dark';
  }

  // Add specific theme variant class
  let variantClass = 'theme-light-white';
  if (safeTheme === 'light-blue') variantClass = 'theme-light-blue';
  else if (safeTheme === 'light-pink') variantClass = 'theme-light-pink';
  else if (safeTheme === 'light-purple') variantClass = 'theme-light-purple';
  else if (safeTheme === 'dark') variantClass = 'theme-dark-black';
  else if (safeTheme === 'dark-gray') variantClass = 'theme-dark-gray';
  else if (safeTheme === 'dark-navy') variantClass = 'theme-dark-navy';

  root.classList.add(variantClass);
  body.classList.add(variantClass);

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: safeTheme } }));
}
