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
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SchoolConfig, UserAccount, AttendanceRecord, SystemLog } from './types';

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
  orgAffiliation: "สพป.อุดรธานี เขต 3",
  logoUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=160&q=80",
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

export async function registerNewUser(userData: Omit<UserAccount, 'id'>): Promise<{ ok: boolean; message: string; status?: 'ACTIVE' | 'PENDING' | 'INACTIVE' }> {
  const userIdentifier = userData.username?.trim() || `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const path = `users/${userIdentifier}`;
  try {
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
      `ลงทะเบียนสมาชิกใหม่: ${userData.fullname} ${statusNote} [Bluetooth MAC: ${userData.registeredMac || 'N/A'}]`
    );

    const message = initialStatus === 'PENDING'
      ? 'ลงทะเบียนและบันทึกฐานข้อมูลใบหน้าสำเร็จ! กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติการใช้งานก่อนเข้าสู่ระบบ'
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

// ==================== ATTENDANCE SERVICES ====================
export async function saveAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<{ ok: boolean; message: string }> {
  const path = 'attendance';
  try {
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

    let msg = 'บันทึกเวลาเรียบร้อยแล้ว';
    if (record.action === 'LEAVE') msg = 'บันทึกข้อมูลการลาเรียบร้อยแล้ว';
    if (record.action === 'OFFICIAL') msg = 'บันทึกข้อมูลการไปราชการเรียบร้อยแล้ว';

    return { ok: true, message: msg };
  } catch (err) {
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
