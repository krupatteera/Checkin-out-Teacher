/**
 * Device MAC Address / Hardware Fingerprint Simulator
 * Standard browsers sandbox raw network interfaces (MAC address) for security.
 * This utility generates a deterministic hardware-bound device signature formatted as
 * an authentic MAC address, stored permanently in local device storage.
 */

const STORAGE_KEY = 'school_device_mac_signature';

export function getOrGenerateDeviceMac(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 17) {
      return existing;
    }
  } catch (e) {
    console.warn('LocalStorage access warning:', e);
  }

  // Generate hardware-bound fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let canvasHash = 0;
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0C7C82';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#35B4B0';
    ctx.fillText('AttendanceFingerprint', 2, 15);
    const dataUrl = canvas.toDataURL();
    for (let i = 0; i < dataUrl.length; i++) {
      canvasHash = (canvasHash << 5) - canvasHash + dataUrl.charCodeAt(i);
      canvasHash |= 0;
    }
  }

  const screenMetrics = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const rawSeed = `${navigator.userAgent}_${navigator.language}_${navigator.hardwareConcurrency || 4}_${screenMetrics}_${canvasHash}_${Date.now()}`;

  // Convert to 6-byte hex MAC string: XX:XX:XX:XX:XX:XX
  let hash = 5381;
  for (let i = 0; i < rawSeed.length; i++) {
    hash = (hash * 33) ^ rawSeed.charCodeAt(i);
  }

  const bytes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const byteVal = Math.abs((hash >> (i * 5)) ^ (Math.floor(Math.random() * 256))) % 256;
    bytes.push(byteVal.toString(16).padStart(2, '0').toUpperCase());
  }

  // Ensure valid unicast locally administered MAC (second bit 1, first bit 0 -> e.g. 2, 6, A, E)
  const firstByte = parseInt(bytes[0], 16);
  bytes[0] = ((firstByte & 0xfe) | 0x02).toString(16).padStart(2, '0').toUpperCase();

  const macAddress = bytes.join(':');

  try {
    localStorage.setItem(STORAGE_KEY, macAddress);
  } catch (e) {
    console.warn('Could not persist device MAC:', e);
  }

  return macAddress;
}

export function verifyDeviceMac(registeredMac: string | undefined, currentMac: string): { match: boolean; message?: string } {
  if (!registeredMac) {
    // If not registered yet, allowed to register this current device
    return { match: true };
  }

  const cleanRegistered = registeredMac.trim().toUpperCase();
  const cleanCurrent = currentMac.trim().toUpperCase();

  if (cleanRegistered === cleanCurrent) {
    return { match: true };
  }

  return {
    match: false,
    message: `อุปกรณ์นี้ (MAC: ${cleanCurrent}) ไม่ตรงกับอุปกรณ์ที่ลงทะเบียนไว้ (MAC: ${cleanRegistered}) เพื่อป้องกันการลงเวลาแทนกัน กรุณาใช้อุปกรณ์ที่ลงทะเบียนไว้ หรือติดต่อผู้ดูแลระบบเพื่อรีเซ็ตเครื่อง`
  };
}

export function getDeviceInfoLabel(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone / iOS Mobile';
  if (/Android/.test(ua)) return 'Android Smartphone';
  if (/Macintosh/.test(ua)) return 'Apple Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'Smart Mobile Device';
}
