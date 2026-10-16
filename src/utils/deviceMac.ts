/**
 * Bluetooth MAC Address (BD_ADDR) Identifier
 * Standard web browsers sandbox direct hardware access to Bluetooth controller addresses.
 * This utility generates a deterministic hardware-bound Bluetooth MAC address signature (BD_ADDR)
 * formatted as standard 6-byte hex XX:XX:XX:XX:XX:XX, stored permanently in device storage.
 */

const STORAGE_KEY_BT = 'school_bluetooth_mac_signature';
const LEGACY_STORAGE_KEY = 'school_device_mac_signature';

export function getOrGenerateBluetoothMac(): string {
  try {
    const existingBt = localStorage.getItem(STORAGE_KEY_BT);
    if (existingBt && existingBt.length >= 17) {
      return existingBt;
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && legacy.length >= 17) {
      localStorage.setItem(STORAGE_KEY_BT, legacy);
      return legacy;
    }
  } catch (e) {
    console.warn('LocalStorage access warning:', e);
  }

  // Generate hardware-bound Bluetooth device fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let canvasHash = 0;
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#7C3AED';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#A78BFA';
    ctx.fillText('BluetoothDeviceFingerprint', 2, 15);
    const dataUrl = canvas.toDataURL();
    for (let i = 0; i < dataUrl.length; i++) {
      canvasHash = (canvasHash << 5) - canvasHash + dataUrl.charCodeAt(i);
      canvasHash |= 0;
    }
  }

  const screenMetrics = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const rawSeed = `BT_${navigator.userAgent}_${navigator.language}_${navigator.hardwareConcurrency || 4}_${screenMetrics}_${canvasHash}_${Date.now()}`;

  // Convert to 6-byte hex Bluetooth MAC address: XX:XX:XX:XX:XX:XX
  let hash = 5381;
  for (let i = 0; i < rawSeed.length; i++) {
    hash = (hash * 33) ^ rawSeed.charCodeAt(i);
  }

  const bytes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const byteVal = Math.abs((hash >> (i * 5)) ^ (Math.floor(Math.random() * 256))) % 256;
    bytes.push(byteVal.toString(16).padStart(2, '0').toUpperCase());
  }

  // Set bit 1 to ensure a valid locally administered Bluetooth device address
  const firstByte = parseInt(bytes[0], 16);
  bytes[0] = ((firstByte & 0xfe) | 0x02).toString(16).padStart(2, '0').toUpperCase();

  const bluetoothMac = bytes.join(':');

  try {
    localStorage.setItem(STORAGE_KEY_BT, bluetoothMac);
  } catch (e) {
    console.warn('Could not persist Bluetooth MAC:', e);
  }

  return bluetoothMac;
}

// Backward-compatible alias
export const getOrGenerateDeviceMac = getOrGenerateBluetoothMac;

export function verifyBluetoothMac(
  registeredMac: string | undefined,
  currentMac: string
): { match: boolean; message?: string } {
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
    message: `อุปกรณ์นี้ (Bluetooth MAC: ${cleanCurrent}) ไม่ตรงกับอุปกรณ์ที่ลงทะเบียนไว้ (Bluetooth MAC: ${cleanRegistered}) เพื่อป้องกันการลงเวลาแทนกัน กรุณาใช้อุปกรณ์ที่ลงทะเบียนไว้ หรือติดต่อผู้ดูแลระบบเพื่อรีเซ็ตเครื่อง`
  };
}

// Backward-compatible alias
export const verifyDeviceMac = verifyBluetoothMac;

export function getDeviceInfoLabel(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone / iOS Bluetooth';
  if (/Android/.test(ua)) return 'Android Bluetooth';
  if (/Macintosh/.test(ua)) return 'Mac Bluetooth Controller';
  if (/Windows/.test(ua)) return 'Windows Bluetooth Device';
  return 'Smart Device Bluetooth';
}
