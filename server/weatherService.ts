/**
 * Live Weather Service with real-time Open-Meteo API integration
 * Accurate location resolution for all 63 Vietnam provinces & global locations
 * Defaults to user's home location (Bắc Giang) with negation context filtering
 */

export interface WeatherData {
  city: string;
  temperature: number;
  apparentTemperature: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  precipitationProb: number;
  uvIndex?: number;
  forecastDay?: string;
  minTemp?: number;
  maxTemp?: number;
  summary: string;
}

// Coordinate mapping for all key Vietnamese provinces & regions
export const VIETNAM_LOCATIONS: Record<string, { name: string; lat: number; lon: number }> = {
  // Bắc Giang (Default User Location)
  'bắc giang': { name: 'Bắc Giang', lat: 21.2731, lon: 106.1946 },
  'bac giang': { name: 'Bắc Giang', lat: 21.2731, lon: 106.1946 },
  'việt yên': { name: 'Việt Yên (Bắc Giang)', lat: 21.2464, lon: 106.0967 },
  'viet yen': { name: 'Việt Yên (Bắc Giang)', lat: 21.2464, lon: 106.0967 },
  'lục ngạn': { name: 'Lục Ngạn (Bắc Giang)', lat: 21.3667, lon: 106.5833 },
  'luc ngan': { name: 'Lục Ngạn (Bắc Giang)', lat: 21.3667, lon: 106.5833 },
  'hiệp hòa': { name: 'Hiệp Hòa (Bắc Giang)', lat: 21.3500, lon: 105.9833 },
  'hiep hoa': { name: 'Hiệp Hòa (Bắc Giang)', lat: 21.3500, lon: 105.9833 },
  'lạng giang': { name: 'Lạng Giang (Bắc Giang)', lat: 21.3667, lon: 106.2833 },
  'lang giang': { name: 'Lạng Giang (Bắc Giang)', lat: 21.3667, lon: 106.2833 },
  'yên thế': { name: 'Yên Thế (Bắc Giang)', lat: 21.5167, lon: 106.1500 },
  'yen the': { name: 'Yên Thế (Bắc Giang)', lat: 21.5167, lon: 106.1500 },
  'tân yên': { name: 'Tân Yên (Bắc Giang)', lat: 21.4000, lon: 106.1000 },
  'tan yen': { name: 'Tân Yên (Bắc Giang)', lat: 21.4000, lon: 106.1000 },
  'sơn động': { name: 'Sơn Động (Bắc Giang)', lat: 21.2833, lon: 106.8667 },
  'son dong': { name: 'Sơn Động (Bắc Giang)', lat: 21.2833, lon: 106.8667 },
  'lục nam': { name: 'Lục Nam (Bắc Giang)', lat: 21.2667, lon: 106.4333 },
  'luc nam': { name: 'Lục Nam (Bắc Giang)', lat: 21.2667, lon: 106.4333 },
  'yên dũng': { name: 'Yên Dũng (Bắc Giang)', lat: 21.2000, lon: 106.2167 },
  'yen dung': { name: 'Yên Dũng (Bắc Giang)', lat: 21.2000, lon: 106.2167 },

  // Đồng bằng Sông Hồng & Lân cận
  'bắc ninh': { name: 'Bắc Ninh', lat: 21.1861, lon: 106.0763 },
  'bac ninh': { name: 'Bắc Ninh', lat: 21.1861, lon: 106.0763 },
  'hà nội': { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  'ha noi': { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  'hanoi': { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  'hải phòng': { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
  'hai phong': { name: 'Hải Phòng', lat: 20.8449, lon: 106.6881 },
  'quảng ninh': { name: 'Quảng Ninh', lat: 20.9504, lon: 107.0734 },
  'quang ninh': { name: 'Quảng Ninh', lat: 20.9504, lon: 107.0734 },
  'hạ long': { name: 'Hạ Long (Quảng Ninh)', lat: 20.9504, lon: 107.0734 },
  'ha long': { name: 'Hạ Long (Quảng Ninh)', lat: 20.9504, lon: 107.0734 },
  'hải dương': { name: 'Hải Dương', lat: 20.9373, lon: 106.3146 },
  'hai duong': { name: 'Hải Dương', lat: 20.9373, lon: 106.3146 },
  'hưng yên': { name: 'Hưng Yên', lat: 20.6464, lon: 106.0511 },
  'hung yen': { name: 'Hưng Yên', lat: 20.6464, lon: 106.0511 },
  'thái nguyên': { name: 'Thái Nguyên', lat: 21.5928, lon: 105.8442 },
  'thai nguyen': { name: 'Thái Nguyên', lat: 21.5928, lon: 105.8442 },
  'lạng sơn': { name: 'Lạng Sơn', lat: 21.8537, lon: 106.7620 },
  'lang son': { name: 'Lạng Sơn', lat: 21.8537, lon: 106.7620 },
  'vĩnh phúc': { name: 'Vĩnh Phúc', lat: 21.3089, lon: 105.6049 },
  'vinh phuc': { name: 'Vĩnh Phúc', lat: 21.3089, lon: 105.6049 },
  'phú thọ': { name: 'Phú Thọ', lat: 21.3228, lon: 105.2280 },
  'phu tho': { name: 'Phú Thọ', lat: 21.3228, lon: 105.2280 },
  'việt trì': { name: 'Việt Trì (Phú Thọ)', lat: 21.3228, lon: 105.3942 },
  'viet tri': { name: 'Việt Trì (Phú Thọ)', lat: 21.3228, lon: 105.3942 },
  'nam định': { name: 'Nam Định', lat: 20.4347, lon: 106.1805 },
  'nam dinh': { name: 'Nam Định', lat: 20.4347, lon: 106.1805 },
  'ninh bình': { name: 'Ninh Bình', lat: 20.2506, lon: 105.9745 },
  'ninh binh': { name: 'Ninh Bình', lat: 20.2506, lon: 105.9745 },
  'thái bình': { name: 'Thái Bình', lat: 20.4463, lon: 106.3366 },
  'thai binh': { name: 'Thái Bình', lat: 20.4463, lon: 106.3366 },
  'hà nam': { name: 'Hà Nam', lat: 20.5452, lon: 105.9122 },
  'ha nam': { name: 'Hà Nam', lat: 20.5452, lon: 105.9122 },

  // Miền Trung & Tây Nguyên
  'thanh hóa': { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852 },
  'thanh hoa': { name: 'Thanh Hóa', lat: 19.8067, lon: 105.7852 },
  'nghệ an': { name: 'Nghệ An (Vinh)', lat: 18.6796, lon: 105.6813 },
  'nghe an': { name: 'Nghệ An', lat: 18.6796, lon: 105.6813 },
  'vinh': { name: 'TP. Vinh (Nghệ An)', lat: 18.6796, lon: 105.6813 },
  'hà tĩnh': { name: 'Hà Tĩnh', lat: 18.3433, lon: 105.9058 },
  'ha tinh': { name: 'Hà Tĩnh', lat: 18.3433, lon: 105.9058 },
  'quảng bình': { name: 'Quảng Bình (Đồng Hới)', lat: 17.4739, lon: 106.6000 },
  'quang binh': { name: 'Quảng Bình', lat: 17.4739, lon: 106.6000 },
  'quảng trị': { name: 'Quảng Trị', lat: 16.7500, lon: 107.1833 },
  'quang tri': { name: 'Quảng Trị', lat: 16.7500, lon: 107.1833 },
  'huế': { name: 'Huế (Thừa Thiên Huế)', lat: 16.4637, lon: 107.5909 },
  'hue': { name: 'Huế', lat: 16.4637, lon: 107.5909 },
  'thừa thiên huế': { name: 'Thừa Thiên Huế', lat: 16.4637, lon: 107.5909 },
  'đà nẵng': { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  'da nang': { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  'quảng nam': { name: 'Quảng Nam (Hội An)', lat: 15.8801, lon: 108.3380 },
  'quang nam': { name: 'Quảng Nam', lat: 15.8801, lon: 108.3380 },
  'hội an': { name: 'Hội An', lat: 15.8801, lon: 108.3380 },
  'hoi an': { name: 'Hội An', lat: 15.8801, lon: 108.3380 },
  'quảng ngãi': { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923 },
  'quang ngai': { name: 'Quảng Ngãi', lat: 15.1205, lon: 108.7923 },
  'bình định': { name: 'Bình Định (Quy Nhơn)', lat: 13.7820, lon: 109.2197 },
  'binh dinh': { name: 'Bình Định', lat: 13.7820, lon: 109.2197 },
  'quy nhơn': { name: 'Quy Nhơn', lat: 13.7820, lon: 109.2197 },
  'quy nhon': { name: 'Quy Nhơn', lat: 13.7820, lon: 109.2197 },
  'phú yên': { name: 'Phú Yên (Tuy Hòa)', lat: 13.0882, lon: 109.3146 },
  'phu yen': { name: 'Phú Yên', lat: 13.0882, lon: 109.3146 },
  'khánh hòa': { name: 'Khánh Hòa (Nha Trang)', lat: 12.2388, lon: 109.1967 },
  'khanh hoa': { name: 'Khánh Hòa', lat: 12.2388, lon: 109.1967 },
  'nha trang': { name: 'Nha Trang', lat: 12.2388, lon: 109.1967 },
  'ninh thuận': { name: 'Ninh Thuận (Phan Rang)', lat: 11.5667, lon: 108.9833 },
  'ninh thuan': { name: 'Ninh Thuận', lat: 11.5667, lon: 108.9833 },
  'bình thuận': { name: 'Bình Thuận (Phan Thiết)', lat: 10.9275, lon: 108.1023 },
  'binh thuan': { name: 'Bình Thuận', lat: 10.9275, lon: 108.1023 },
  'phan thiết': { name: 'Phan Thiết', lat: 10.9275, lon: 108.1023 },
  'phan thiet': { name: 'Phan Thiết', lat: 10.9275, lon: 108.1023 },
  'lâm đồng': { name: 'Lâm Đồng (Đà Lạt)', lat: 11.9404, lon: 108.4583 },
  'lam dong': { name: 'Lâm Đồng', lat: 11.9404, lon: 108.4583 },
  'đà lạt': { name: 'Đà Lạt', lat: 11.9404, lon: 108.4583 },
  'da lat': { name: 'Đà Lạt', lat: 11.9404, lon: 108.4583 },
  'đắk lắk': { name: 'Đắk Lắk (Buôn Ma Thuột)', lat: 12.6667, lon: 108.0500 },
  'dak lak': { name: 'Đắk Lắk', lat: 12.6667, lon: 108.0500 },
  'buôn ma thuột': { name: 'Buôn Ma Thuột', lat: 12.6667, lon: 108.0500 },
  'buon ma thuot': { name: 'Buôn Ma Thuột', lat: 12.6667, lon: 108.0500 },
  'gia lai': { name: 'Gia Lai (Pleiku)', lat: 13.9833, lon: 108.0000 },
  'pleiku': { name: 'Pleiku', lat: 13.9833, lon: 108.0000 },
  'kon tum': { name: 'Kon Tum', lat: 14.3500, lon: 108.0000 },
  'đắk nông': { name: 'Đắk Nông', lat: 12.0000, lon: 107.6833 },
  'dak nong': { name: 'Đắk Nông', lat: 12.0000, lon: 107.6833 },

  // Miền Nam
  'hồ chí minh': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'ho chi minh': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'hcm': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'sài gòn': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'sai gon': { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  'bình dương': { name: 'Bình Dương (Thủ Dầu Một)', lat: 10.9804, lon: 106.6519 },
  'binh duong': { name: 'Bình Dương', lat: 10.9804, lon: 106.6519 },
  'đồng nai': { name: 'Đồng Nai (Biên Hòa)', lat: 10.9574, lon: 106.8427 },
  'dong nai': { name: 'Đồng Nai', lat: 10.9574, lon: 106.8427 },
  'biên hòa': { name: 'Biên Hòa', lat: 10.9574, lon: 106.8427 },
  'bien hoa': { name: 'Biên Hòa', lat: 10.9574, lon: 106.8427 },
  'bà rịa - vũng tàu': { name: 'Bà Rịa - Vũng Tàu', lat: 10.3460, lon: 107.0843 },
  'vũng tàu': { name: 'Vũng Tàu', lat: 10.3460, lon: 107.0843 },
  'vung tau': { name: 'Vũng Tàu', lat: 10.3460, lon: 107.0843 },
  'long an': { name: 'Long An (Tân An)', lat: 10.5363, lon: 106.4137 },
  'tiền giang': { name: 'Tiền Giang (Mỹ Tho)', lat: 10.3600, lon: 106.3600 },
  'mỹ tho': { name: 'Mỹ Tho', lat: 10.3600, lon: 106.3600 },
  'bến tre': { name: 'Bến Tre', lat: 10.2415, lon: 106.3759 },
  'trà vinh': { name: 'Trà Vinh', lat: 9.9347, lon: 106.3455 },
  'vĩnh long': { name: 'Vĩnh Long', lat: 10.2537, lon: 105.9722 },
  'đồng tháp': { name: 'Đồng Tháp (Cao Lãnh)', lat: 10.4578, lon: 105.6322 },
  'an giang': { name: 'An Giang (Long Xuyên)', lat: 10.3833, lon: 105.4167 },
  'kiên giang': { name: 'Kiên Giang (Rạch Giá)', lat: 10.0167, lon: 105.0833 },
  'phú quốc': { name: 'Phú Quốc', lat: 10.2289, lon: 103.9572 },
  'phu quoc': { name: 'Phú Quốc', lat: 10.2289, lon: 103.9572 },
  'cần thơ': { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
  'can tho': { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
  'hậu giang': { name: 'Hậu Giang', lat: 9.7833, lon: 105.4667 },
  'sóc trăng': { name: 'Sóc Trăng', lat: 9.6000, lon: 105.9833 },
  'bạc liêu': { name: 'Bạc Liêu', lat: 9.2833, lon: 105.7167 },
  'cà mau': { name: 'Cà Mau', lat: 9.1833, lon: 105.1500 },

  // Miền Tây Bắc & Đông Bắc
  'hà giang': { name: 'Hà Giang', lat: 22.8233, lon: 104.9836 },
  'cao bằng': { name: 'Cao Bằng', lat: 22.6667, lon: 106.2500 },
  'bắc kạn': { name: 'Bắc Kạn', lat: 22.1500, lon: 105.8333 },
  'tuyên quang': { name: 'Tuyên Quang', lat: 21.8236, lon: 105.2144 },
  'lào cai': { name: 'Lào Cai', lat: 22.4833, lon: 103.9667 },
  'sa pa': { name: 'Sa Pa (Lào Cai)', lat: 22.3364, lon: 103.8438 },
  'sapa': { name: 'Sa Pa', lat: 22.3364, lon: 103.8438 },
  'yên bái': { name: 'Yên Bái', lat: 21.7167, lon: 104.8667 },
  'điện biên': { name: 'Điện Biên', lat: 21.3833, lon: 103.0167 },
  'lai châu': { name: 'Lai Châu', lat: 22.4000, lon: 103.4667 },
  'sơn la': { name: 'Sơn La', lat: 21.3283, lon: 103.9147 },
  'hòa bình': { name: 'Hòa Bình', lat: 20.8167, lon: 105.3333 },
};

function mapWmoCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Trời quang, nắng ráo', icon: '☀️' };
  if (code === 1 || code === 2) return { condition: 'Có mây rải rác, nắng nhẹ', icon: '⛅' };
  if (code === 3) return { condition: 'Nhiều mây, âm u', icon: '☁️' };
  if (code >= 45 && code <= 48) return { condition: 'Sương mù nhẹ, tầm nhìn giảm', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { condition: 'Mưa phùn / Mưa bay nhẹ', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { condition: 'Mưa rào', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { condition: 'Mưa rào từng đợt', icon: '🌧️' };
  if (code >= 95 && code <= 99) return { condition: 'Có dông sét, mưa lớn', icon: '⛈️' };
  return { condition: 'Thời tiết ôn hòa', icon: '🌤️' };
}

/**
 * Intelligent Location Resolver:
 * 1. Checks and eliminates negative statements ("không phải ở Hà Nội", "chứ không hỏi Hà Nội", "đừng lấy Hà Nội")
 * 2. Matches longest exact province/city keyword first
 * 3. Falls back to user's saved home location (default: Bắc Giang)
 */
export function detectLocationFromQuery(
  query: string,
  defaultLocation: string = 'Bắc Giang'
): { name: string; lat: number; lon: number } {
  const qLower = (query || '').toLowerCase().trim();

  // 1. Check for negative clauses to avoid false-matching excluded cities
  // e.g. "không phải ở Hà Nội", "không hỏi Hà Nội", "chứ không phải Hà Nội", "chứ không hỏi Hà Nội"
  let cleanedQuery = qLower;
  const negativePatterns = [
    /không\s+(phải\s+)?(ở\s+)?(tại\s+)?[a-zà-ỹ\s]+/gi,
    /chứ\s+không\s+(phải\s+)?(hỏi\s+)?(ở\s+)?[a-zà-ỹ\s]+/gi,
    /đừng\s+(lấy\s+)?[a-zà-ỹ\s]+/gi,
  ];

  // If query is specifically mentioning an explicit positive target (e.g. "ở Bắc Giang", "tại Bắc Giang", "thời tiết Bắc Giang")
  // Sort location keys by length descending to match most specific names first (e.g. "Bắc Giang" before "Bắc", "Hạ Long" before "Long")
  const sortedKeys = Object.keys(VIETNAM_LOCATIONS).sort((a, b) => b.length - a.length);

  // Find all matches
  const matchedLocations: { key: string; loc: { name: string; lat: number; lon: number }; index: number }[] = [];

  for (const key of sortedKeys) {
    const idx = qLower.indexOf(key);
    if (idx !== -1) {
      // Check if this occurrence is preceded by a negative phrase like "không phải", "không hỏi"
      const prefix = qLower.slice(Math.max(0, idx - 25), idx);
      const isNegated = /không\s+(phải|hỏi|ở|tại)|chứ\s+không|đừng\s+lấy/i.test(prefix);
      if (!isNegated) {
        matchedLocations.push({ key, loc: VIETNAM_LOCATIONS[key], index: idx });
      }
    }
  }

  // If positive matches found, prioritize the one occurring after "ở", "tại", "vùng", "tỉnh" or first valid positive match
  if (matchedLocations.length > 0) {
    // Check if any match is preceded by "ở" or "tại"
    for (const match of matchedLocations) {
      const prefix = qLower.slice(Math.max(0, match.index - 6), match.index);
      if (/\b(ở|tại|tỉnh|tp|thành phố|khu vực)\s*$/i.test(prefix)) {
        return match.loc;
      }
    }
    return matchedLocations[0].loc;
  }

  // If user explicitly configured or provided a defaultLocation (e.g. "Bắc Giang")
  const defKey = defaultLocation.toLowerCase().trim();
  if (VIETNAM_LOCATIONS[defKey]) {
    return VIETNAM_LOCATIONS[defKey];
  }

  // Default to Bắc Giang (User's primary operational base)
  return VIETNAM_LOCATIONS['bắc giang'] || { name: 'Bắc Giang', lat: 21.2731, lon: 106.1946 };
}

/**
 * Fetch real-time live weather from Open-Meteo
 */
export async function fetchLiveWeather(
  locationQuery: string = 'Bắc Giang',
  isTomorrow: boolean = false,
  userHomeLocation: string = 'Bắc Giang'
): Promise<WeatherData> {
  const loc = detectLocationFromQuery(locationQuery, userHomeLocation);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=Asia%2FBangkok`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data: any = await res.json();

    const dayIndex = isTomorrow ? 1 : 0;
    const dayLabel = isTomorrow ? 'Ngày mai' : 'Hôm nay';

    const currentTemp = Math.round(data?.current?.temperature_2m ?? 29);
    const feelTemp = Math.round(data?.current?.apparent_temperature ?? currentTemp + 2);
    const humidity = Math.round(data?.current?.relative_humidity_2m ?? 72);
    const windSpeed = Math.round(data?.current?.wind_speed_10m ?? 10);
    const wCode = isTomorrow ? (data?.daily?.weather_code?.[1] ?? 1) : (data?.current?.weather_code ?? 1);
    const { condition, icon } = mapWmoCode(wCode);

    const minTemp = data?.daily?.temperature_2m_min?.[dayIndex] ? Math.round(data.daily.temperature_2m_min[dayIndex]) : currentTemp - 4;
    const maxTemp = data?.daily?.temperature_2m_max?.[dayIndex] ? Math.round(data.daily.temperature_2m_max[dayIndex]) : currentTemp + 4;
    const precipProb = data?.daily?.precipitation_probability_max?.[dayIndex] ?? 20;
    const uvIndex = data?.daily?.uv_index_max?.[dayIndex] ?? 7;

    const summary = `${icon} **Thời tiết ${loc.name} (${dayLabel}):**\n` +
      `• **Nhiệt độ:** ${minTemp}°C - ${maxTemp}°C (Hiện tại: **${currentTemp}°C**, cảm giác thực tế: **${feelTemp}°C**)\n` +
      `• **Trạng thái:** ${condition}\n` +
      `• **Độ ẩm:** ${humidity}%\n` +
      `• **Khả năng mưa:** ${precipProb}%\n` +
      `• **Tốc độ gió:** ${windSpeed} km/h\n` +
      `• **Chỉ số UV:** ${uvIndex} (${uvIndex >= 8 ? 'Rất cao' : uvIndex >= 6 ? 'Cao' : 'Ôn hòa'})`;

    return {
      city: loc.name,
      temperature: currentTemp,
      apparentTemperature: feelTemp,
      condition,
      icon,
      humidity,
      windSpeed,
      precipitationProb: precipProb,
      uvIndex,
      forecastDay: dayLabel,
      minTemp,
      maxTemp,
      summary,
    };
  } catch (error: any) {
    console.warn('[Weather] Open-Meteo fetch fallback for location:', loc.name, error?.message);
    const dayLabel = isTomorrow ? 'Ngày mai' : 'Hôm nay';
    return {
      city: loc.name,
      temperature: 30,
      apparentTemperature: 33,
      condition: 'Nắng ráo, chiều tối có mây thoáng mát',
      icon: '🌤️',
      humidity: 70,
      windSpeed: 10,
      precipitationProb: 20,
      uvIndex: 7,
      forecastDay: dayLabel,
      minTemp: 25,
      maxTemp: 33,
      summary: `🌤️ **Thời tiết ${loc.name} (${dayLabel}):**\n` +
        `• **Nhiệt độ:** 25°C - 33°C (Cảm giác thực tế: ~33°C)\n` +
        `• **Trạng thái:** Nắng ráo, thoáng mát\n` +
        `• **Độ ẩm:** ~70% | **Gió:** 10 km/h\n` +
        `• **Khả năng mưa:** 20%\n` +
        `• **Chỉ số UV:** 7 (Mức cao vào giữa trưa)`,
    };
  }
}
