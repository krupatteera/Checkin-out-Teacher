import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy,
  limit,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SchoolConfig, UserAccount, AttendanceRecord, SystemLog, HolidaySetting, HolidaysConfigMap } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'config', 'school_main'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection: the client appears offline or pending first sync.");
    }
  }
}
testConnection();

// Default initial config
export const DEFAULT_CONFIG: SchoolConfig = {
  orgName: "โรงเรียนอนุบาลศรีสุทโธ",
  systemName: "ระบบลงเวลาปฏิบัติงานออนไลน์สำหรับครูและบุคลากรทางการศึกษา",
  orgAffiliation: "สพป.อุดรธานี เขต 3",
  logoUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=160&q=80",
  academicYear: "2569",
  lateTime: "08:30",
  earlyTime: "16:30",
  centerLat: 17.413840,
  centerLng: 102.787260,
  radius: 150,
  adminPin: "000000"
};

// ==================== CONFIG SERVICES ====================
export async function getSchoolConfig(): Promise<SchoolConfig> {
  const path = 'config/school_main';
  try {
    const snap = await getDoc(doc(db, 'config', 'school_main'));
    if (snap.exists()) {
      return { id: snap.id, ...DEFAULT_CONFIG, ...snap.data() } as SchoolConfig;
    }
    // Initialize default if not exist
    await setDoc(doc(db, 'config', 'school_main'), DEFAULT_CONFIG);
    return { id: 'school_main', ...DEFAULT_CONFIG };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveSchoolConfig(config: Partial<SchoolConfig>): Promise<void> {
  const path = 'config/school_main';
  try {
    await setDoc(doc(db, 'config', 'school_main'), config, { merge: true });
    await writeSystemLog('ADMIN', 'CONFIG', 'อัปเดตการตั้งค่าระบบและเกณฑ์เวลาพื้นที่โรงเรียน');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ==================== USER SERVICES ====================
export async function findUserByUsername(username: string): Promise<UserAccount | null> {
  const path = 'users';
  try {
    const cleanUser = username.trim();
    // Direct lookup by document id first
    const directDoc = await getDoc(doc(db, 'users', cleanUser));
    if (directDoc.exists()) {
      return { id: directDoc.id, ...directDoc.data() } as UserAccount;
    }
    // Query by username field
    const q = query(collection(db, 'users'), where('username', '==', cleanUser), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const first = snap.docs[0];
      return { id: first.id, ...first.data() } as UserAccount;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function checkBluetoothMacRegistered(
  macAddress: string,
  excludeUserId?: string
): Promise<{ isDuplicate: boolean; existingUser?: { username: string; fullname: string; role: string } }> {
  if (!macAddress) return { isDuplicate: false };
  const cleanTarget = macAddress.trim().toUpperCase();

  try {
    const snap = await getDocs(collection(db, 'users'));
    for (const d of snap.docs) {
      const data = d.data() as UserAccount;
      if (excludeUserId && (data.username === excludeUserId || d.id === excludeUserId)) {
        continue;
      }
      const userMac = (data.registeredMac || '').trim().toUpperCase();
      if (userMac && userMac === cleanTarget) {
        return {
          isDuplicate: true,
          existingUser: {
            username: data.username || d.id,
            fullname: data.fullname || data.username || d.id,
            role: data.role || 'teacher'
          }
        };
      }
    }
    return { isDuplicate: false };
  } catch (err) {
    console.warn('Error checking Bluetooth MAC duplication:', err);
    return { isDuplicate: false };
  }
}

export async function authenticateTeacherUser(
  username: string,
  password: string
): Promise<{ ok: boolean; user?: UserAccount; message: string }> {
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanUser || !cleanPass) {
    return { ok: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน' };
  }

  const user = await findUserByUsername(cleanUser);
  if (!user) {
    return { ok: false, message: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ กรุณาตรวจสอบหรือลงทะเบียนใหม่' };
  }

  if (user.password && user.password !== cleanPass) {
    return { ok: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
  }

  if (user.status === 'PENDING') {
    return {
      ok: false,
      message: 'บัญชีอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ กรุณาแจ้งผู้ดูแลระบบเพื่อเปิดใช้งานก่อนเข้าสู่ระบบ'
    };
  }

  if (user.status === 'INACTIVE') {
    return { ok: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
  }

  return { ok: true, user, message: 'เข้าสู่ระบบสำเร็จ' };
}

export async function registerNewUser(userData: Omit<UserAccount, 'id'>): Promise<{ ok: boolean; message: string; status?: 'ACTIVE' | 'PENDING' | 'INACTIVE' }> {
  const userIdentifier = userData.username?.trim() || `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const path = `users/${userIdentifier}`;
  try {
    // Check duplicate username if username was provided
    if (userData.username) {
      const existingUser = await findUserByUsername(userData.username.trim());
      if (existingUser) {
        return {
          ok: false,
          message: `ชื่อผู้ใช้งาน "${userData.username.trim()}" ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้งานอื่น`
        };
      }
    }

    // Check duplicate Bluetooth MAC address
    if (userData.registeredMac) {
      const macCheck = await checkBluetoothMacRegistered(userData.registeredMac, userIdentifier);
      if (macCheck.isDuplicate) {
        return {
          ok: false,
          message: `อุปกรณ์นี้ (Bluetooth MAC: ${userData.registeredMac}) ได้ลงทะเบียนในระบบแล้ว โดยคุณ "${macCheck.existingUser?.fullname || ''}" ไม่อนุญาตให้ลงทะเบียนซ้ำจากเครื่องเดียวกัน`
        };
      }
    }

    const initialStatus = userData.status || (userData.role === 'admin' ? 'ACTIVE' : 'PENDING');

    const newDocRef = doc(db, 'users', userIdentifier);
    await setDoc(newDocRef, {
      ...userData,
      username: userIdentifier,
      status: initialStatus,
      createdAt: new Date().toISOString()
    });

    const statusNote = initialStatus === 'PENDING' ? '(รอผู้ดูแลระบบอนุมัติ)' : '(เปิดใช้งานทันที)';
    await writeSystemLog(
      userIdentifier,
      'REGISTER',
      `ลงทะเบียนสมาชิกใหม่: ${userData.fullname} (@${userIdentifier}) ${statusNote} [Bluetooth MAC: ${userData.registeredMac || 'N/A'}]`
    );

    const message = initialStatus === 'PENDING'
      ? 'ลงทะเบียนสมาชิกเรียบร้อยแล้ว! กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติการใช้งานก่อนเข้าสู่ระบบ'
      : 'ลงทะเบียนสมาชิกสำเร็จ! สามารถเข้าสู่ระบบได้ทันที';

    return { ok: true, message, status: initialStatus };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function approveUserAccount(userId: string, adminUsername: string): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      status: 'ACTIVE',
      approvedAt: new Date().toISOString(),
      approvedBy: adminUsername
    });
    await writeSystemLog(adminUsername, 'APPROVE_USER', `อนุมัติบัญชีครู/บุคลากร: ${userId}`);
    return { ok: true, message: `อนุมัติผู้ใช้งาน ${userId} เรียบร้อยแล้ว ครูสามารถเข้าสู่ระบบและลงเวลาได้ทันที` };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function rejectUserAccount(userId: string, adminUsername: string, reason = ''): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      status: 'INACTIVE',
      rejectedReason: reason
    });
    await writeSystemLog(adminUsername, 'REJECT_USER', `ปฏิเสธ/ระงับบัญชี ${userId}: ${reason || 'ข้อมูลไม่ผ่านเกณฑ์'}`);
    return { ok: true, message: `ระงับบัญชีผู้ใช้งาน ${userId} เรียบร้อยแล้ว` };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleUserAccountStatus(
  userId: string,
  targetStatus: 'ACTIVE' | 'INACTIVE',
  adminUsername: string
): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    const updatePayload: Record<string, any> = {
      status: targetStatus,
      updatedAt: new Date().toISOString()
    };
    if (targetStatus === 'ACTIVE') {
      updatePayload.approvedAt = new Date().toISOString();
      updatePayload.approvedBy = adminUsername;
    }
    await updateDoc(doc(db, 'users', userId), updatePayload);
    const actionText = targetStatus === 'ACTIVE' ? 'เปิดการใช้งานบัญชี' : 'ปิดการใช้งานบัญชี';
    await writeSystemLog(adminUsername, 'TOGGLE_USER_STATUS', `${actionText}: ${userId}`);
    return { ok: true, message: `${actionText} ${userId} เรียบร้อยแล้ว` };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileData(userId: string, data: Partial<UserAccount>): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), data);
    await writeSystemLog(userId, 'EDIT_PROFILE', 'อัปเดตข้อมูลส่วนตัว');
    return { ok: true, message: 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว' };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function getAllUsersList(): Promise<UserAccount[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserAccount));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteUserAccount(userId: string): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
    await writeSystemLog('ADMIN', 'DELETE_USER', `ลบผู้ใช้งาน ${userId}`);
    return { ok: true, message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function resetUserMacAddress(userId: string): Promise<{ ok: boolean; message: string }> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), { registeredMac: '' });
    await writeSystemLog('ADMIN', 'RESET_MAC', `รีเซ็ตการผูกอุปกรณ์ Bluetooth MAC Address ของ ${userId}`);
    return { ok: true, message: 'รีเซ็ต Bluetooth MAC Address สำเร็จ ครูสามารถเข้าสู่ระบบเพื่อจดจำเครื่องใหม่ได้ทันที' };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// LINE Notify Helper
async function sendLineNotify(message: string, token?: string) {
  if (!token || !token.trim()) return;
  try {
    // Note: Since LINE Notify blocks direct browser fetch due to CORS in some environments,
    // we use a cors proxy or standard endpoint. Alternatively, standard fetch to notify-api.line.me:
    const formData = new URLSearchParams();
    formData.append('message', message);
    
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token.trim()}`
      },
      body: formData.toString()
    }).catch(() => {
      // Fallback or ignore network CORS restriction in frontend-only preview
    });
  } catch (e) {
    console.error('LINE Notify error:', e);
  }
}

// ==================== ATTENDANCE SERVICES ====================
export async function saveAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<{ ok: boolean; message: string }> {
  const path = 'attendance';
  try {
    // Check existing records for this user on this date to enforce strict mutual exclusion rules:
    // 1. If already clocked in (IN) or out (OUT), cannot submit LEAVE or OFFICIAL.
    // 2. If already submitted LEAVE or OFFICIAL, cannot clock in/out or submit the other.
    const existingQ = query(
      collection(db, 'attendance'),
      where('userId', '==', record.userId),
      where('date', '==', record.date)
    );
    const existingSnap = await getDocs(existingQ);
    const existingRecords = existingSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord & { id: string }));

    const hasIn = existingRecords.some(r => r.action === 'IN');
    const hasOut = existingRecords.some(r => r.action === 'OUT');
    const hasLeave = existingRecords.some(r => r.action === 'LEAVE');
    const hasOfficial = existingRecords.some(r => r.action === 'OFFICIAL');

    if (record.action === 'LEAVE' || record.action === 'OFFICIAL') {
      for (const r of existingRecords) {
        await deleteDoc(doc(db, 'attendance', r.id));
      }
    }

    if (record.action === 'IN' || record.action === 'OUT') {
      for (const r of existingRecords) {
        if (r.action === 'LEAVE' || r.action === 'OFFICIAL') {
          await deleteDoc(doc(db, 'attendance', r.id));
        }
      }
    }

    // Generate doc ID: YYYY-MM-DD_username_action
    const docId = `${record.date}_${record.userId}_${record.action}_${Date.now()}`;
    await setDoc(doc(db, 'attendance', docId), record);
    
    const actionLabel = record.action === 'IN' ? 'ลงเวลาเข้างาน' :
      record.action === 'OUT' ? 'ลงเวลากลับ' :
      record.action === 'LEAVE' ? `แจ้งลาหยุด (${record.note || ''})` :
      `ไปราชการ (${record.note || ''})`;

    await writeSystemLog(
      record.userId,
      'ATTENDANCE',
      `${actionLabel} | เวลา: ${record.time} | พิกัด: ${record.lat?.toFixed(5) || '-'}, ${record.lng?.toFixed(5) || '-'} | ห่าง: ${record.distance || 0} ม. | MAC: ${record.macAddress || '-'}`
    );

    // If check-in (IN) and isLate is true, send LINE Notify if configured
    if (record.action === 'IN' && record.isLate) {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'school_main'));
        if (configSnap.exists()) {
          const cfg = configSnap.data() as SchoolConfig;
          if (cfg.lineNotifyToken) {
            const lineMsg = `\n🚨 แจ้งเตือนลงเวลามาสาย\n- ครู/บุคลากร: ${record.employeeName} (@${record.employeeId})\n- วันที่: ${record.dateThai || record.date}\n- เวลาเข้างาน: ${record.time} น. (สายกว่าเกณฑ์ ${cfg.lateTime || '08:30'} น.)\n- ระยะห่าง: ${record.distance || 0} เมตร`;
            await sendLineNotify(lineMsg, cfg.lineNotifyToken);
          }
        }
      } catch (notifyErr) {
        console.error('Failed to send LINE notify for late check-in:', notifyErr);
      }
    }

    let msg = 'บันทึกเวลาเรียบร้อยแล้ว';
    if (record.action === 'LEAVE') msg = 'บันทึกข้อมูลการลาเรียบร้อยแล้ว';
    if (record.action === 'OFFICIAL') msg = 'บันทึกข้อมูลการไปราชการเรียบร้อยแล้ว';

    return { ok: true, message: msg };
  } catch (err: any) {
    // If it's a validation error (e.g. mutual exclusion rule), throw directly so the frontend can display it cleanly without logging as a Firestore crash
    if (err instanceof Error && err.message && !err.message.includes('Missing or insufficient permissions')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getAttendanceByDate(dateStr: string): Promise<AttendanceRecord[]> {
  const path = 'attendance';
  try {
    const q = query(collection(db, 'attendance'), where('date', '==', dateStr));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getAttendanceByMonth(yearMonthStr: string): Promise<AttendanceRecord[]> {
  const path = 'attendance';
  try {
    // date starts with yearMonthStr e.g. "2026-10"
    const snap = await getDocs(collection(db, 'attendance'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    return all.filter(r => r.date && r.date.startsWith(yearMonthStr));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getAttendanceByDateRange(startDateStr: string, endDateStr: string): Promise<AttendanceRecord[]> {
  const path = 'attendance';
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    return all.filter(r => r.date && r.date >= startDateStr && r.date <= endDateStr);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getUserStatusToday(userId: string, dateStr: string) {
  const path = 'attendance';
  try {
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', userId),
      where('date', '==', dateStr)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));

    let timeIn = '--:--';
    let timeOut = '--:--';
    let leaveNote = '';
    let officialNote = '';

    list.forEach(r => {
      if (r.action === 'IN' && timeIn === '--:--') timeIn = r.time;
      if (r.action === 'OUT' && timeOut === '--:--') timeOut = r.time;
      if (r.action === 'LEAVE' && !leaveNote) leaveNote = r.note || 'ลาหยุด';
      if (r.action === 'OFFICIAL' && !officialNote) officialNote = r.note || 'ไปราชการ';
    });

    return {
      summary: { in: timeIn, out: timeOut, leave: leaveNote, official: officialNote },
      todayRecords: list
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getUserRecentHistory(userId: string): Promise<AttendanceRecord[]> {
  const path = 'attendance';
  try {
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 15);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function cancelAttendanceItem(recordId: string, userId: string, actionType: string): Promise<{ ok: boolean; message: string }> {
  const path = `attendance/${recordId}`;
  try {
    await deleteDoc(doc(db, 'attendance', recordId));
    await writeSystemLog('ADMIN', `CANCEL_${actionType}`, `ยกเลิกข้อมูล ${actionType} ของ ${userId} (ID: ${recordId})`);
    return { ok: true, message: 'ยกเลิกข้อมูลสำเร็จเรียบร้อย' };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ==================== SYSTEM LOGS ====================
export async function writeSystemLog(user: string, action: string, details: string): Promise<void> {
  const path = 'logs';
  try {
    const now = new Date();
    const timeStr = now.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + now.toLocaleTimeString('th-TH', { hour12: false });

    const logDoc: SystemLog = {
      time: timeStr,
      user,
      action,
      details,
      timestamp: now.getTime()
    };
    await setDoc(doc(db, 'logs', `${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`), logDoc);
  } catch (err) {
    console.warn('Logging skipped/error:', err);
  }
}

export async function getSystemLogsList(): Promise<SystemLog[]> {
  const path = 'logs';
  try {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
  } catch {
    // Fallback without index
    const snap = await getDocs(collection(db, 'logs'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  }
}

// ==================== HOLIDAYS CONFIG SERVICES ====================
export async function getSchoolHolidays(forceServer = true): Promise<HolidaysConfigMap> {
  const path = 'config/school_holidays';
  try {
    const docRef = doc(db, 'config', 'school_holidays');
    let snap;
    if (forceServer) {
      try {
        snap = await getDocFromServer(docRef);
      } catch {
        snap = await getDoc(docRef);
      }
    } else {
      snap = await getDoc(docRef);
    }
    if (snap.exists()) {
      return (snap.data()?.holidays || {}) as HolidaysConfigMap;
    }
    return {};
  } catch (err) {
    console.warn('Error getting school holidays:', err);
    return {};
  }
}

export function subscribeSchoolHolidays(callback: (map: HolidaysConfigMap) => void): () => void {
  const docRef = doc(db, 'config', 'school_holidays');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data()?.holidays || {};
        callback(data as HolidaysConfigMap);
      } else {
        callback({});
      }
    },
    (err) => {
      console.warn('Error in subscribeSchoolHolidays listener:', err);
    }
  );
}

export async function saveSchoolHoliday(
  setting: HolidaySetting,
  adminUsername: string
): Promise<{ ok: boolean; message: string }> {
  const path = 'config/school_holidays';
  try {
    const docRef = doc(db, 'config', 'school_holidays');
    const snap = await getDoc(docRef);
    const currentMap = snap.exists() ? (snap.data()?.holidays || {}) : {};
    currentMap[setting.date] = {
      ...setting,
      updatedBy: adminUsername,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, { holidays: currentMap }, { merge: true });
    await writeSystemLog(
      adminUsername,
      'HOLIDAY_CONFIG',
      `กำหนดสถานะวัน ${setting.date}: ${setting.isHoliday ? 'วันหยุด (' + (setting.name || 'วันหยุดพิเศษ') + ')' : 'วันทำการพิเศษ (' + (setting.name || 'เปิดทำการ') + ')'}`
    );
    return { ok: true, message: `บันทึกข้อมูลวันที่ ${setting.date} เรียบร้อยแล้ว` };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function removeSchoolHoliday(
  dateStr: string,
  adminUsername: string
): Promise<{ ok: boolean; message: string }> {
  const path = 'config/school_holidays';
  try {
    const docRef = doc(db, 'config', 'school_holidays');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const currentMap = snap.data()?.holidays || {};
      delete currentMap[dateStr];
      await setDoc(docRef, { holidays: currentMap });
      await writeSystemLog(adminUsername, 'HOLIDAY_CONFIG', `รีเซ็ตสถานะวัน ${dateStr} กลับสู่ค่าเริ่มต้น (เสาร์-อาทิตย์หยุด, จันทร์-ศุกร์ทำงาน)`);
    }
    return { ok: true, message: `รีเซ็ตวันที่ ${dateStr} กลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว` };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveBatchHolidays(
  holidaysMap: HolidaysConfigMap,
  adminUsername: string
): Promise<{ ok: boolean; message: string }> {
  const path = 'config/school_holidays';
  try {
    const docRef = doc(db, 'config', 'school_holidays');
    await setDoc(docRef, { holidays: holidaysMap }, { merge: true });
    await writeSystemLog(adminUsername, 'HOLIDAY_CONFIG', `อัปเดตวันหยุดนักขัตฤกษ์ประจำปีอัตโนมัติ`);
    return { ok: true, message: 'บันทึกวันหยุดนักขัตฤกษ์เรียบร้อยแล้ว' };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ==================== DATA PURGE / DELETION SERVICES ====================

/**
 * ลบข้อมูลการลงเวลา: รายบุคคล (ตาม userId หรือ employeeId)
 */
export async function deleteAttendanceByUser(
  userId: string,
  teacherName: string,
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'attendance';
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const matchedDocs = snap.docs.filter((d) => {
      const data = d.data();
      return data.userId === userId || data.employeeId === userId;
    });

    if (matchedDocs.length === 0) {
      return { ok: true, deletedCount: 0, message: `ไม่พบข้อมูลการลงเวลาของคุณ ${teacherName} ในฐานข้อมูล` };
    }

    // Delete in batches of 400
    const batchSize = 400;
    for (let i = 0; i < matchedDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = matchedDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await writeSystemLog(
      adminUsername,
      'DELETE_ATTENDANCE_USER',
      `ลบข้อมูลการลงเวลาของ "${teacherName}" (ID: ${userId}) ทั้งหมด ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    );

    return {
      ok: true,
      deletedCount: matchedDocs.length,
      message: `ลบข้อมูลการลงเวลาของคุณ ${teacherName} จำนวน ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * ลบข้อมูลการลงเวลา: รายบุคคล (ตาม userId) และสามารถระบุวันที่ (dateStr) เฉพาะเจาะจงได้
 */
export async function deleteAttendanceByUserAndDate(
  userId: string,
  teacherName: string,
  dateStr: string | null,
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'attendance';
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const matchedDocs = snap.docs.filter((d) => {
      const data = d.data();
      const matchUser = data.userId === userId || data.employeeId === userId;
      if (!matchUser) return false;
      if (dateStr) {
        return data.date === dateStr;
      }
      return true; // if dateStr is null/empty, delete all records for this user
    });

    if (matchedDocs.length === 0) {
      const dateInfo = dateStr ? ` ประจำวันที่ ${dateStr}` : '';
      return { ok: true, deletedCount: 0, message: `ไม่พบข้อมูลการลงเวลาของคุณ ${teacherName}${dateInfo} ในฐานข้อมูล` };
    }

    const batchSize = 400;
    for (let i = 0; i < matchedDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = matchedDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const logDetail = dateStr
      ? `ลบข้อมูลการลงเวลาของ "${teacherName}" (ID: ${userId}) ประจำวันที่ ${dateStr} จำนวน ${matchedDocs.length} รายการ`
      : `ลบข้อมูลการลงเวลาของ "${teacherName}" (ID: ${userId}) ทั้งหมด ${matchedDocs.length} รายการ`;

    await writeSystemLog(adminUsername, 'DELETE_ATTENDANCE_USER_DATE', logDetail);

    const msgDetail = dateStr
      ? `ลบข้อมูลการลงเวลาของคุณ ${teacherName} ประจำวันที่ ${dateStr} จำนวน ${matchedDocs.length} รายการเรียบร้อยแล้ว`
      : `ลบข้อมูลการลงเวลาของคุณ ${teacherName} ทั้งหมด ${matchedDocs.length} รายการเรียบร้อยแล้ว`;

    return {
      ok: true,
      deletedCount: matchedDocs.length,
      message: msgDetail
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * ลบข้อมูลการลงเวลา: เฉพาะวันที่กำหนด (ตาม dateStr เช่น '2026-10-22')
 */
export async function deleteAttendanceByDate(
  dateStr: string,
  dateThaiDisplay: string,
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'attendance';
  try {
    const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', dateStr)));
    const matchedDocs = snap.docs;

    if (matchedDocs.length === 0) {
      return { ok: true, deletedCount: 0, message: `ไม่พบข้อมูลการลงเวลาประจำวันที่ ${dateThaiDisplay} (${dateStr}) ในฐานข้อมูล` };
    }

    // Delete in batches of 400
    const batchSize = 400;
    for (let i = 0; i < matchedDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = matchedDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await writeSystemLog(
      adminUsername,
      'DELETE_ATTENDANCE_DATE',
      `ลบข้อมูลการลงเวลาประจำวันที่ ${dateThaiDisplay} (${dateStr}) ทั้งหมด ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    );

    return {
      ok: true,
      deletedCount: matchedDocs.length,
      message: `ลบข้อมูลการลงเวลาประจำวันที่ ${dateThaiDisplay} จำนวน ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * ลบข้อมูลการลงเวลา: ทั้งหมดในระบบ
 */
export async function deleteAllAttendance(
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'attendance';
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const allDocs = snap.docs;

    if (allDocs.length === 0) {
      return { ok: true, deletedCount: 0, message: 'ไม่มีข้อมูลการลงเวลาในฐานข้อมูล' };
    }

    // Delete in batches of 400
    const batchSize = 400;
    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = allDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await writeSystemLog(
      adminUsername,
      'DELETE_ALL_ATTENDANCE',
      `ลบข้อมูลการลงเวลาทั้งหมดในระบบ รวม ${allDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    );

    return {
      ok: true,
      deletedCount: allDocs.length,
      message: `ลบข้อมูลการลงเวลาทั้งหมดจำนวน ${allDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * ลบประวัติระบบ (Logs): รายเดือน
 */
export async function deleteLogsByMonth(
  yearMonthStr: string,
  monthThaiDisplay: string,
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'logs';
  try {
    const snap = await getDocs(collection(db, 'logs'));
    const [yStr, mStr] = yearMonthStr.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const startMs = new Date(y, m - 1, 1).getTime();
    const endMs = new Date(y, m, 0, 23, 59, 59, 999).getTime();

    const matchedDocs = snap.docs.filter((d) => {
      const data = d.data();
      const ts = data.timestamp;
      if (typeof ts === 'number') {
        return ts >= startMs && ts <= endMs;
      }
      return false;
    });

    if (matchedDocs.length === 0) {
      return { ok: true, deletedCount: 0, message: `ไม่พบประวัติระบบประจำเดือน ${monthThaiDisplay} ในฐานข้อมูล` };
    }

    const batchSize = 400;
    for (let i = 0; i < matchedDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = matchedDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await writeSystemLog(
      adminUsername,
      'DELETE_MONTHLY_LOGS',
      `ลบประวัติระบบประจำเดือน ${monthThaiDisplay} (${yearMonthStr}) จำนวน ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    );

    return {
      ok: true,
      deletedCount: matchedDocs.length,
      message: `ลบประวัติระบบประจำเดือน ${monthThaiDisplay} จำนวน ${matchedDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * ลบประวัติระบบ (Logs): ทั้งหมด
 */
export async function deleteAllLogs(
  adminUsername: string
): Promise<{ ok: boolean; deletedCount: number; message: string }> {
  const path = 'logs';
  try {
    const snap = await getDocs(collection(db, 'logs'));
    const allDocs = snap.docs;

    if (allDocs.length === 0) {
      return { ok: true, deletedCount: 0, message: 'ไม่มีประวัติระบบในฐานข้อมูล' };
    }

    const batchSize = 400;
    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = allDocs.slice(i, i + batchSize);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // เขียน log บันทึกการล้างข้อมูลครั้งนี้ไว้เป็นรายการแรกใหม่
    await writeSystemLog(
      adminUsername,
      'PURGE_ALL_LOGS',
      `ล้างประวัติระบบทั้งหมดในฐานข้อมูลเรียบร้อยแล้ว (จำนวนเดิม ${allDocs.length} รายการ)`
    );

    return {
      ok: true,
      deletedCount: allDocs.length,
      message: `ลบประวัติระบบทั้งหมดจำนวน ${allDocs.length} รายการ ออกจากฐานข้อมูลเรียบร้อยแล้ว`
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

