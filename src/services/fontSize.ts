import { AppFontSize, FontSizeOption } from '../types/index.js';

const FONT_SIZE_STORAGE_KEY = 'architect_os_font_size';

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  {
    id: 'small',
    label: 'A-',
    name: 'Cỡ Chữ Nhỏ (Compact)',
    scalePercent: 90,
    pixelSize: 14.4,
    description: 'Thu nhỏ 90%, tăng mật độ hiển thị nhiều thông tin và dòng dữ liệu hơn trên màn hình.',
  },
  {
    id: 'medium',
    label: 'A',
    name: 'Cỡ Chữ Chuẩn (Default)',
    scalePercent: 100,
    pixelSize: 16,
    description: 'Kích cỡ 100% mặc định theo kiến trúc thiết kế hệ thống, cân đối và sắc nét chuẩn mắt nhìn.',
  },
  {
    id: 'large',
    label: 'A+',
    name: 'Cỡ Chữ Lớn (Comfort)',
    scalePercent: 112.5,
    pixelSize: 18,
    description: 'Phóng to 112.5%, chữ to rõ ràng, hạn chế tối đa cảm giác mỏi mắt khi làm việc và đọc tài liệu dài.',
  },
  {
    id: 'xlarge',
    label: 'A++',
    name: 'Cỡ Chữ Rất Lớn (Accessible)',
    scalePercent: 125,
    pixelSize: 20,
    description: 'Phóng to 125% theo chuẩn trợ năng WCAG AAA, quan sát từ xa hoặc trên màn hình độ phân giải cao cực tốt.',
  },
];

const VALID_FONT_SIZES: AppFontSize[] = ['small', 'medium', 'large', 'xlarge'];

/**
 * Get current persisted font size, defaulting to 'medium'
 */
export function getSavedFontSize(): AppFontSize {
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY) as AppFontSize;
    if (VALID_FONT_SIZES.includes(saved)) {
      return saved;
    }
  } catch {}
  return 'medium';
}

/**
 * Apply font size to document element and body
 */
export function applyFontSize(size: AppFontSize): void {
  const safeSize: AppFontSize = VALID_FONT_SIZES.includes(size) ? size : 'medium';

  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, safeSize);
  } catch {}

  const root = document.documentElement;
  const body = document.body;

  // Remove previous font size classes
  VALID_FONT_SIZES.forEach(s => {
    root.classList.remove(`font-size-${s}`);
    body.classList.remove(`font-size-${s}`);
  });

  root.classList.add(`font-size-${safeSize}`);
  body.classList.add(`font-size-${safeSize}`);

  // Set explicit root font-size so that all Tailwind rem units scale harmoniously
  let rootPx = '16px';
  if (safeSize === 'small') rootPx = '14.4px';
  else if (safeSize === 'medium') rootPx = '16px';
  else if (safeSize === 'large') rootPx = '18px';
  else if (safeSize === 'xlarge') rootPx = '20px';

  root.style.fontSize = rootPx;

  // Dispatch custom event for listeners
  window.dispatchEvent(
    new CustomEvent('fontsizechange', {
      detail: { fontSize: safeSize, rootPx },
    })
  );
}
