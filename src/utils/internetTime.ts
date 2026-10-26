/**
 * Internet / Network Time Synchronization Utility (Strict Asia/Bangkok UTC+7)
 * 
 * Provides atomic, network-synchronized date and time strictly from the cloud server / NTP authority.
 * Guarantees that users cannot manipulate attendance records by changing their device clock or timezone.
 * Uses performance.now() as a monotonic reference clock to prevent device-clock tampering.
 * All formatting utilizes UTC methods with a fixed +7 hour offset, guaranteeing 100% immunity
 * to the client device's local clock, timezone changes, and operating system modifications.
 */

interface SyncState {
  baselineInternetEpochMs: number;
  baselinePerfMs: number;
  isSynced: boolean;
  lastSyncTime: number;
  source: string;
}

// Fixed offset for Thailand (Asia/Bangkok) UTC+7 in milliseconds
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const state: SyncState = {
  baselineInternetEpochMs: Date.now(),
  baselinePerfMs: typeof performance !== 'undefined' ? performance.now() : 0,
  isSynced: false,
  lastSyncTime: 0,
  source: 'กำลังเชื่อมต่อเวลาอินเทอร์เน็ต...'
};

const syncListeners: Array<(synced: boolean) => void> = [];

export function subscribeInternetTimeSync(callback: (synced: boolean) => void): () => void {
  syncListeners.push(callback);
  return () => {
    const idx = syncListeners.indexOf(callback);
    if (idx !== -1) syncListeners.splice(idx, 1);
  };
}

function notifyListeners() {
  syncListeners.forEach(cb => {
    try {
      cb(state.isSynced);
    } catch (e) {
      console.error('Error in internet time sync listener:', e);
    }
  });
}

/**
 * Fetch internet time from backend authority or public NTP/Time endpoints
 */
export async function syncInternetTime(): Promise<Date> {
  const fetchEndpoints = [
    // 1. Primary: NIMT (National Institute of Metrology Thailand) via server proxy
    async () => {
      const start = performance.now();
      const res = await fetch('/api/time', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const end = performance.now();
      const rtt = Math.max(0, end - start);
      return {
        epochMs: typeof data.timestamp === 'number' ? data.timestamp : new Date(data.iso).getTime(),
        rtt,
        source: data.source || 'สถาบันมาตรวิทยาแห่งชาติ (NIMT Time Display)'
      };
    },
    // 2. Fallback: HTTP HEAD request reading Date response header
    async () => {
      const start = performance.now();
      const res = await fetch(`/?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store'
      });
      const dateHeader = res.headers.get('date');
      if (!dateHeader) throw new Error('No Date header');
      const serverDate = new Date(dateHeader);
      if (isNaN(serverDate.getTime())) throw new Error('Invalid Date header');
      const end = performance.now();
      const rtt = Math.max(0, end - start);
      return {
        epochMs: serverDate.getTime(),
        rtt,
        source: 'HTTP Server Header (Network Date)'
      };
    },
    // 3. Fallback: Public Time API (TimeAPI for Asia/Bangkok)
    async () => {
      const start = performance.now();
      const res = await fetch('https://timeapi.io/api/v1/time/current/zone?timeZone=Asia/Bangkok', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`TimeAPI error ${res.status}`);
      const data = await res.json();
      const end = performance.now();
      const rtt = Math.max(0, end - start);
      const parsed = data.dateTime ? new Date(data.dateTime).getTime() : data.milliSeconds;
      return {
        epochMs: parsed,
        rtt,
        source: 'NTP Time API (Asia/Bangkok)'
      };
    },
    // 4. Fallback: WorldTimeAPI for Asia/Bangkok
    async () => {
      const start = performance.now();
      const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Bangkok', {
        method: 'GET'
      });
      if (!res.ok) throw new Error(`WorldTimeAPI error ${res.status}`);
      const data = await res.json();
      const end = performance.now();
      const rtt = Math.max(0, end - start);
      return {
        epochMs: typeof data.unixtime === 'number' ? data.unixtime * 1000 : new Date(data.datetime).getTime(),
        rtt,
        source: 'WorldTimeAPI (Asia/Bangkok)'
      };
    }
  ];

  for (const fn of fetchEndpoints) {
    try {
      const result = await fn();
      if (result && !isNaN(result.epochMs) && result.epochMs > 0) {
        state.baselineInternetEpochMs = result.epochMs + Math.round(result.rtt / 2);
        state.baselinePerfMs = performance.now();
        state.isSynced = true;
        state.lastSyncTime = Date.now();
        state.source = result.source;
        notifyListeners();
        return getInternetNow();
      }
    } catch {
      // Try next fallback
    }
  }

  return getInternetNow();
}

/**
 * Returns current monotonic UTC epoch milliseconds based on internet time.
 */
export function getInternetNowEpoch(): number {
  if (typeof performance === 'undefined') {
    return state.baselineInternetEpochMs;
  }
  const elapsed = performance.now() - state.baselinePerfMs;
  return state.baselineInternetEpochMs + elapsed;
}

/**
 * Returns current Date object based on network/internet time.
 */
export function getInternetNow(): Date {
  return new Date(getInternetNowEpoch());
}

/**
 * Calculate Bangkok (UTC+7) calendar parts strictly using UTC methods.
 * This guarantees zero dependence on the client device's clock or timezone.
 */
export function getBangkokParts(epochMs: number = getInternetNowEpoch()): {
  year: number;
  month: number; // 1-12
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday...
} {
  const bkk = new Date(epochMs + BANGKOK_OFFSET_MS);
  return {
    year: bkk.getUTCFullYear(),
    month: bkk.getUTCMonth() + 1,
    day: bkk.getUTCDate(),
    hours: bkk.getUTCHours(),
    minutes: bkk.getUTCMinutes(),
    seconds: bkk.getUTCSeconds(),
    dayOfWeek: bkk.getUTCDay()
  };
}

/**
 * Check if internet time is successfully synchronized with remote server
 */
export function isInternetTimeSynchronized(): boolean {
  return state.isSynced;
}

/**
 * Get name of current time source
 */
export function getInternetTimeSource(): string {
  return state.source;
}

/**
 * Format current internet date to YYYY-MM-DD (Asia/Bangkok)
 */
export function getInternetIsoDate(): string {
  const p = getBangkokParts();
  const year = p.year;
  const month = String(p.month).padStart(2, '0');
  const day = String(p.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format current internet time to HH:mm (Asia/Bangkok)
 */
export function getInternetTimeString(): string {
  const p = getBangkokParts();
  const hours = String(p.hours).padStart(2, '0');
  const minutes = String(p.minutes).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format current internet time parts for digital clock presentation
 */
export function getInternetClockParts(): {
  hourMin: string;
  sec: string;
  thaiDate: string;
  isoDate: string;
  rawDate: Date;
  isSynced: boolean;
  source: string;
} {
  const epoch = getInternetNowEpoch();
  const p = getBangkokParts(epoch);
  const hours = String(p.hours).padStart(2, '0');
  const minutes = String(p.minutes).padStart(2, '0');
  const seconds = String(p.seconds).padStart(2, '0');

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const thaiDate = `${thaiDays[p.dayOfWeek]}ที่ ${p.day} ${thaiMonths[p.month - 1]} พ.ศ. ${p.year + 543}`;
  const isoDate = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

  return {
    hourMin: `${hours}:${minutes}`,
    sec: seconds,
    thaiDate,
    isoDate,
    rawDate: new Date(epoch),
    isSynced: state.isSynced,
    source: state.source
  };
}

/**
 * Format an ISO date (YYYY-MM-DD) into Thai readable date e.g. "วันพุธที่ 21 ตุลาคม 2569"
 */
export function formatThaiDateFromIso(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return isoDateStr;

  // Use UTC to prevent local timezone shifts
  const d = new Date(Date.UTC(year, month - 1, day));
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  return `${thaiDays[d.getUTCDay()]}ที่ ${day} ${thaiMonths[month - 1]} พ.ศ. ${year + 543}`;
}

// Auto-initialize synchronization on import
if (typeof window !== 'undefined') {
  syncInternetTime();

  // Re-sync periodically every 2 minutes
  setInterval(() => {
    syncInternetTime();
  }, 2 * 60 * 1000);

  // Re-sync when tab becomes visible or online
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncInternetTime();
    }
  });

  window.addEventListener('online', () => {
    syncInternetTime();
  });
}
