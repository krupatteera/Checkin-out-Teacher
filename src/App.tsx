import React, { useState, useEffect, useRef } from 'react';
import {
  School,
  Lock,
  User,
  KeyRound,
  Smartphone,
  MapPin,
  Clock,
  LogOut,
  CalendarCheck,
  CalendarOff,
  Briefcase,
  UserPlus,
  RefreshCw,
  Menu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  Settings,
  FileClock,
  Bluetooth,
  Upload,
  Loader2,
  Check,
  GraduationCap,
  FileText,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { SchoolConfig, UserAccount, AttendanceRecord } from './types';
import {
  getSchoolConfig,
  findUserByUsername,
  registerNewUser,
  authenticateTeacherUser,
  getUserStatusToday,
  getUserRecentHistory,
  saveAttendanceRecord,
  getAllUsersList,
  getSchoolHolidays,
  subscribeSchoolHolidays,
  DEFAULT_CONFIG
} from './firebase';
import { getOrGenerateBluetoothMac, getDeviceInfoLabel } from './utils/deviceMac';
import { Swal } from './utils/sweetAlert';
import { compressImageBase64 } from './utils/imageUtils';
import { RegisterModal } from './components/RegisterModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AdminConfigModal } from './components/AdminConfigModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AdminReports } from './components/AdminReports';
import { Navigation } from './components/Navigation';
import { TeacherReport, formatTableLeaveDisplay, formatTableOfficialDisplay } from './components/TeacherReport';
import { fetchPreciseGpsPosition } from './utils/gpsPrecision';
import { AdminHolidaysModal } from './components/AdminHolidaysModal';
import { AdminDeleteDataModal } from './components/AdminDeleteDataModal';
import { TeacherDashboard } from './components/TeacherDashboard';
import { evaluateDayHolidayStatus } from './components/TeacherReport';
import { TeacherLeaveModal } from './components/TeacherLeaveModal';
import { TeacherOfficialModal } from './components/TeacherOfficialModal';
import {
  getInternetNow,
  getInternetIsoDate,
  getInternetTimeString,
  getInternetClockParts,
  isInternetTimeSynchronized,
  getInternetTimeSource,
  syncInternetTime
} from './utils/internetTime';

// Calculate distance in meters between two coordinates (Haversine Formula)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function App() {
  // Global System State
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_CONFIG);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Active view tab
  const [currentTab, setCurrentTab] = useState<'teacher-dashboard' | 'home' | 'teacher-report' | 'admin-dashboard' | 'admin-summary' | 'admin-map' | 'admin-logs'>('teacher-dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Attendance user data (Teachers only)
  const [todaySummary, setTodaySummary] = useState({ in: '--:--', out: '--:--', leave: '', official: '' });
  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [holidaysMap, setHolidaysMap] = useState<import('./types').HolidaysConfigMap>({});

  // Real-time GPS tracker state
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const lastGpsUpdateRef = useRef<number>(0);
  const bestAccuracyRef = useRef<number>(9999);

  // Teacher Login Form State (User & Password)
  const [loginUsername, setLoginUsername] = useState(() => localStorage.getItem('saved_teacher_username') || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  // Current real-time clock
  const [timeString, setTimeString] = useState({ hourMin: '00:00', sec: '00' });
  const [thaiDateString, setThaiDateString] = useState('');

  // Modals state
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [holidaysModalOpen, setHolidaysModalOpen] = useState(false);
  const [deleteDataModalOpen, setDeleteDataModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [officialModalOpen, setOfficialModalOpen] = useState(false);

  // Admin filter dates (Synchronized via Internet Time)
  const [selectedAdminDate, setSelectedAdminDate] = useState(() => getInternetIsoDate());
  const [selectedAdminMonth, setSelectedAdminMonth] = useState(() => getInternetIsoDate().substring(0, 7));

  // Device Bluetooth MAC Address
  const currentDeviceMac = getOrGenerateBluetoothMac();
  const deviceLabel = getDeviceInfoLabel();

  // Current Academic Year (ปีการศึกษา) derived from Internet Time
  const currentAcademicYear = config.academicYear || (() => {
    const now = getInternetNow();
    const beYear = now.getFullYear() + 543;
    const m = now.getMonth() + 1; // 1-12
    return String(m >= 5 ? beYear : beYear - 1);
  })();

  // Clock runner - Synchronized via Internet Time (Immune to device clock modification)
  useEffect(() => {
    const updateTime = () => {
      const parts = getInternetClockParts();
      setTimeString({
        hourMin: parts.hourMin,
        sec: parts.sec
      });
      setThaiDateString(parts.thaiDate);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial school config & check default admin
  useEffect(() => {
    const initApp = async () => {
      try {
        // Sync internet time from authority before querying attendance
        await syncInternetTime().catch(() => {});

        const loadedConfig = await getSchoolConfig();
        setConfig(loadedConfig);
        const holidays = await getSchoolHolidays();
        setHolidaysMap(holidays);

        // Check if admin exists in database, if not create default admin account
        const adminCheck = await findUserByUsername('admin');
        if (!adminCheck) {
          await registerNewUser({
            username: 'admin',
            fullname: 'ผู้ดูแลระบบ (Admin)',
            position: 'ผู้ดูแลระบบ',
            department: 'บริหารทั่วไป',
            role: 'admin',
            status: 'ACTIVE',
            registeredMac: ''
          });
        }

        // Restore logged in user session from sessionStorage if any
        const savedSession = sessionStorage.getItem('attendance_active_user');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          setCurrentUser(parsed);
          if (parsed.role === 'admin') {
            setCurrentTab('admin-dashboard');
          } else {
            fetchUserAttendance(parsed.id);
            setCurrentTab('home');
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();
  }, []);

  // Real-time synchronization of school holidays & working day overrides
  useEffect(() => {
    const unsubscribe = subscribeSchoolHolidays((latestMap) => {
      setHolidaysMap(latestMap);
    });
    return () => unsubscribe();
  }, []);

  // Ensure Admin never lands on teacher clock-in view
  useEffect(() => {
    if (currentUser?.role === 'admin' && currentTab === 'home') {
      setCurrentTab('admin-dashboard');
    }
  }, [currentUser, currentTab]);

  // GPS Accuracy Tracker: multi-sample convergence to acquire real satellite coordinates
  const refreshGpsLocation = async (showSpinner = true) => {
    if (!navigator.geolocation) {
      setGpsError('เบราว์เซอร์ไม่รองรับ GPS');
      return;
    }

    if (showSpinner) {
      setGpsLoading(true);
    }

    try {
      // 1. Run multi-sample convergence to acquire pinpoint satellite fix
      const precise = await fetchPreciseGpsPosition(4500, 15);
      const lat = precise.lat;
      const lng = precise.lng;
      const acc = precise.accuracy;

      bestAccuracyRef.current = acc;
      lastGpsUpdateRef.current = Date.now();

      setGpsCoords({ lat, lng });
      setGpsAccuracy(acc);
      setGpsError(null);

      const centerLat = config.centerLat || 17.413840;
      const centerLng = config.centerLng || 102.787260;
      const dist = calculateDistanceMeters(lat, lng, centerLat, centerLng);
      setGpsDistance(dist);
    } catch (err) {
      console.warn('GPS precision fetch fallback:', err);
      // Fallback to one-shot high accuracy
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = Math.round(pos.coords.accuracy || 20);
          bestAccuracyRef.current = acc;
          lastGpsUpdateRef.current = Date.now();

          setGpsCoords({ lat, lng });
          setGpsAccuracy(acc);
          setGpsError(null);

          const centerLat = config.centerLat || 17.413840;
          const centerLng = config.centerLng || 102.787260;
          const dist = calculateDistanceMeters(lat, lng, centerLat, centerLng);
          setGpsDistance(dist);
        },
        (e) => {
          console.warn('GPS error:', e);
          setGpsError('ไม่สามารถดึงพิกัด GPS ได้ กรุณาเปิดสิทธิ์การเข้าถึงตำแหน่งและเปิดบริการ GPS');
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        }
      );
    } finally {
      if (showSpinner) {
        setGpsLoading(false);
      }
    }
  };

  // Continuous GPS Tracker: watchPosition with precision spike filtering
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || currentTab !== 'home') return;
    if (!navigator.geolocation) return;

    // 1. Initial precision refresh
    refreshGpsLocation(false);

    // 2. watchPosition for live hardware GPS coordinates stream
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 20);
        const now = Date.now();

        // Prevent coarse readings (e.g. 150m cell tower jump) from overriding good satellite lock
        const isBetterOrEqual = acc <= bestAccuracyRef.current + 5;
        const isStale = (now - lastGpsUpdateRef.current) > 15000;

        if (isBetterOrEqual || isStale) {
          bestAccuracyRef.current = acc;
          lastGpsUpdateRef.current = now;

          setGpsCoords({ lat, lng });
          setGpsAccuracy(acc);
          setGpsError(null);

          const centerLat = config.centerLat || 17.413840;
          const centerLng = config.centerLng || 102.787260;
          const dist = calculateDistanceMeters(lat, lng, centerLat, centerLng);
          setGpsDistance(dist);
        }
      },
      (err) => {
        console.warn('GPS watch error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );

    // 3. Periodic sanity check every 15s to keep lock fresh if silent
    const interval = setInterval(() => {
      if (!gpsCoords || (Date.now() - lastGpsUpdateRef.current) > 15000) {
        refreshGpsLocation(false);
      }
    }, 15000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [currentUser, currentTab, config]);

  // Fetch user attendance status
  const fetchUserAttendance = async (userId: string) => {
    setHistoryLoading(true);
    try {
      const todayStr = getInternetIsoDate();
      const [statusRes, historyRes] = await Promise.all([
        getUserStatusToday(userId, todayStr),
        getUserRecentHistory(userId)
      ]);
      setTodaySummary(statusRes.summary);
      setUserHistory(historyRes);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // TEACHER LOGIN HANDLER (USER & PASSWORD)
  // --------------------------------------------------------------------------
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = loginUsername.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanUser || !cleanPass) {
      Swal.fire({
        title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
        text: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน',
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    setLoginLoading(true);
    try {
      const res = await authenticateTeacherUser(cleanUser, cleanPass);
      if (!res.ok || !res.user) {
        Swal.fire({
          title: 'เข้าสู่ระบบไม่สำเร็จ',
          text: res.message,
          icon: 'error',
          confirmButtonColor: '#7C3AED'
        });
        return;
      }

      const authenticatedUser = res.user;

      // Check / Bind Bluetooth MAC Address
      if (!authenticatedUser.registeredMac) {
        authenticatedUser.registeredMac = currentDeviceMac;
      }

      // Save or remove Remember Username
      if (rememberUsername) {
        localStorage.setItem('saved_teacher_username', cleanUser);
      } else {
        localStorage.removeItem('saved_teacher_username');
      }

      setCurrentUser(authenticatedUser);
      sessionStorage.setItem('attendance_active_user', JSON.stringify(authenticatedUser));

      await Swal.fire({
        title: 'เข้าสู่ระบบสำเร็จ!',
        html: `
          <div class="text-center text-xs text-slate-600 space-y-1">
            <p class="font-bold text-slate-800 text-sm">ยินดีต้อนรับ คุณ ${authenticatedUser.fullname}</p>
            <p class="text-slate-500 text-[11px]">${authenticatedUser.position || 'ครูผู้สอน'} &bull; ${authenticatedUser.department || 'โรงเรียน'}</p>
          </div>
        `,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      if (authenticatedUser.role === 'admin') {
        setCurrentTab('admin-dashboard');
      } else {
        fetchUserAttendance(authenticatedUser.id);
        setCurrentTab('home');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    const res = await Swal.fire({
      title: 'ยืนยันการออกจากระบบ?',
      text: 'คุณต้องการออกจากระบบลงเวลาปฏิบัติงานใช่หรือไม่',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED'
    });

    if (res.isConfirmed) {
      sessionStorage.removeItem('attendance_active_user');
      setCurrentUser(null);
      setMobileMenuOpen(false);
      Swal.fire({
        title: 'ออกจากระบบสำเร็จ',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false
      });
    }
  };

  // --------------------------------------------------------------------------
  // DIRECT CLOCK IN / OUT (NO FACE SCANNER - ONLY BLUETOOTH MAC + GPS)
  // Mutual exclusion: When clocked in/out today -> CANNOT LEAVE or OFFICIAL!
  // When leave or official today -> CANNOT CLOCK IN or CLOCK OUT!
  // --------------------------------------------------------------------------
  const handleDirectClock = async (action: 'IN' | 'OUT') => {
    if (!currentUser || currentUser.role === 'admin') return;

    // 1. Mutual exclusion: If already on leave or official duty today -> CANNOT CLOCK IN / OUT
    if (todaySummary.leave) {
      Swal.fire({
        title: 'ไม่สามารถลงเวลาได้',
        text: `วันนี้คุณได้แจ้งลาหยุด (${todaySummary.leave}) ไปแล้ว ตามระเบียบเมื่อลาแล้วจะไม่สามารถลงเวลาได้`,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    if (todaySummary.official) {
      Swal.fire({
        title: 'ไม่สามารถลงเวลาได้',
        text: `วันนี้คุณได้บันทึกไปราชการ (${todaySummary.official}) แล้ว ตามระเบียบเมื่อไปราชการแล้วจะไม่สามารถลงเวลาได้`,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    // Check if today is a holiday (using internet date + fresh server holiday data)
    const todayStr = getInternetIsoDate();
    let currentHolidays = holidaysMap;
    try {
      const freshHolidays = await getSchoolHolidays(true);
      if (freshHolidays && Object.keys(freshHolidays).length > 0) {
        currentHolidays = freshHolidays;
        setHolidaysMap(freshHolidays);
      }
    } catch {
      // fallback to current in-memory holidaysMap
    }

    const holidayStatus = evaluateDayHolidayStatus(todayStr, currentHolidays);
    if (holidayStatus.isHoliday) {
      Swal.fire({
        title: 'ไม่อนุญาตให้ลงเวลา!',
        text: `วันนี้เป็นวันหยุด (${holidayStatus.holidayName}) ระบบไม่เปิดให้ลงเวลาปฏิบัติงาน`,
        icon: 'error',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    // Check check-out constraints (Direct clock-out without requiring clock-in)
    if (action === 'OUT') {
      if (todaySummary.out !== '--:--') {
        Swal.fire('ลงเวลากลับแล้ว', `คุณได้ลงเวลากลับไปแล้วเมื่อ ${todaySummary.out} น.`, 'info');
        return;
      }
    }

    // 2. Validate Bluetooth MAC Address
    if (currentUser.registeredMac && currentUser.registeredMac !== currentDeviceMac) {
      Swal.fire({
        title: 'ไม่อนุญาตให้ลงเวลา!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold">รหัส Bluetooth MAC ไม่ตรงกับเครื่องที่ลงทะเบียนไว้</p>
            <div class="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
              <p>เครื่องที่ผูกไว้: <span class="font-mono text-purple-900">${currentUser.registeredMac}</span></p>
              <p>เครื่องปัจจุบัน: <span class="font-mono text-rose-800">${currentDeviceMac}</span> (${deviceLabel})</p>
            </div>
            <p class="text-[11px] text-slate-500">ระบบจำกัดให้ลงเวลาได้เฉพาะอุปกรณ์ที่ลงทะเบียนไว้เท่านั้นเพื่อป้องกันการลงเวลาแทนกัน</p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    // 3. Validate GPS Position & Radius
    const allowedRadius = config.radius || 150;
    let effectiveDist = gpsDistance;
    let effectiveCoords = gpsCoords;
    let effectiveAcc = gpsAccuracy || 20;

    // Calculate accuracy buffer: compensates for minor hardware GNSS drift (max 25m)
    let accuracyTolerance = Math.min(effectiveAcc * 0.45, 25);

    // If no coordinates yet, or currently outside boundary, or coarse accuracy (> 25m), run high-precision convergence
    if (!effectiveCoords || effectiveDist === null || effectiveDist > (allowedRadius + accuracyTolerance) || effectiveAcc > 25) {
      try {
        const precise = await fetchPreciseGpsPosition(4000, 15);
        const centerLat = config.centerLat || 17.413840;
        const centerLng = config.centerLng || 102.787260;
        effectiveCoords = { lat: precise.lat, lng: precise.lng };
        effectiveAcc = precise.accuracy;
        effectiveDist = calculateDistanceMeters(precise.lat, precise.lng, centerLat, centerLng);

        setGpsCoords(effectiveCoords);
        setGpsAccuracy(effectiveAcc);
        setGpsDistance(effectiveDist);
        bestAccuracyRef.current = effectiveAcc;
        lastGpsUpdateRef.current = Date.now();
        accuracyTolerance = Math.min(effectiveAcc * 0.45, 25);
      } catch (e) {
        // use existing readings if convergence fails
      }
    }

    if (!effectiveCoords || effectiveDist === null) {
      Swal.fire({
        title: 'กำลังค้นหาพิกัด GPS',
        text: 'ระบบกำลังดึงพิกัดดาวเทียม กรุณารอสักครู่หรือกดปุ่ม "ปรับเทียบพิกัด" ด้านบน',
        icon: 'info',
        confirmButtonColor: '#7C3AED'
      });
      refreshGpsLocation(true);
      return;
    }

    if (effectiveDist > (allowedRadius + accuracyTolerance)) {
      Swal.fire({
        title: 'อยู่นอกพื้นที่โรงเรียน!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold">ท่านอยู่ห่างจากโรงเรียนเกินระยะที่กำหนด</p>
            <div class="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
              <p>ระยะห่างปัจจุบัน: <b>${effectiveDist} เมตร</b></p>
              <p>รัศมีที่อนุญาต: <b>ไม่เกิน ${allowedRadius} เมตร</b></p>
              <p class="text-[10px] text-slate-500 mt-1">ความแม่นยำดาวเทียม: ±${effectiveAcc} ม.</p>
            </div>
            <p class="text-[11px] text-slate-500">
              💡 แนะนำ: หากท่านอยู่ในบริเวณโรงเรียนแล้ว ให้กดปุ่ม <b>"ปรับเทียบพิกัดดาวเทียม"</b> ด้านบน หรือออกสู่ที่โล่งแจ้งเพื่อช่วยให้อุปกรณ์ล็อกดาวเทียมได้แม่นยำ
            </p>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      refreshGpsLocation(true);
      return;
    }

    // 4. Save Attendance Record directly with GPS + Bluetooth MAC + Internet Time
    const now = getInternetNow();
    const dateStr = getInternetIsoDate();
    const timeStr = getInternetTimeString();
    const clockParts = getInternetClockParts();

    const isEarly = Boolean(action === 'OUT' && config.earlyTime && timeStr < config.earlyTime);

    let finalNote = '';
    if (isEarly) finalNote = 'กลับก่อนเวลา';

    try {
      await saveAttendanceRecord({
        userId: currentUser.id,
        employeeId: currentUser.username || currentUser.id,
        employeeName: currentUser.fullname,
        action,
        date: dateStr,
        dateThai: clockParts.thaiDate,
        time: timeStr,
        lat: effectiveCoords.lat,
        lng: effectiveCoords.lng,
        distance: effectiveDist,
        isLate: false,
        isEarly,
        note: finalNote,
        macAddress: currentDeviceMac,
        timestamp: now.getTime()
      });

      await Swal.fire({
        title: 'ลงเวลากลับสำเร็จ!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <p class="text-sm font-bold text-purple-900">เวลา: ${timeStr} น. ${isEarly ? '<span class="text-amber-600 font-bold">(กลับก่อนเวลา)</span>' : '<span class="text-emerald-600 font-bold">(ตรงเวลา)</span>'}</p>
              <p class="text-[11px] text-slate-500 mt-1">พิกัด GPS: ${effectiveCoords.lat.toFixed(5)}, ${effectiveCoords.lng.toFixed(5)} (ห่าง ร.ร. ${effectiveDist} ม.)</p>
              <p class="text-[11px] font-mono text-purple-800 mt-0.5">Bluetooth MAC: ${currentDeviceMac}</p>
            </div>
            <p class="text-[10px] text-emerald-700 font-bold">✓ บันทึกเวลากลับด้วยพิกัด GPS และ Bluetooth MAC เรียบร้อยแล้ว</p>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#7C3AED'
      });

      fetchUserAttendance(currentUser.id);
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // --------------------------------------------------------------------------
  // LEAVE & OFFICIAL DUTY MODAL OPENERS
  // Opens dedicated reactive modals with date/period selection & internet time
  // --------------------------------------------------------------------------
  const handleLeaveRequest = () => {
    if (!currentUser || currentUser.role === 'admin') return;
    setLeaveModalOpen(true);
  };

  const handleOfficialDutyRequest = () => {
    if (!currentUser || currentUser.role === 'admin') return;
    setOfficialModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // RENDER: TEACHER FACE LOGIN + FLOATING ADMIN PIN BUTTON (WHEN LOGGED OUT)
  // --------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-purple-50/40 to-slate-100 p-3 sm:p-5 lg:p-8 relative">
        <div className="flex-1 flex items-center justify-center py-2 sm:py-4">
          <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl md:rounded-[32px] shadow-xl md:shadow-2xl shadow-purple-950/10 border border-purple-100 overflow-hidden grid grid-cols-1 md:grid-cols-12 transition-all my-auto">
            {/* Left Column: School Info & Branding */}
            <div className="md:col-span-5 bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#8B5CF6] p-5 sm:p-7 md:p-8 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#C4B5FD]/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#8B5CF6]/25 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-5">
                  {config.logoUrl ? (
                    <img
                      src={config.logoUrl}
                      alt="Logo"
                      className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl object-cover shadow-lg border-2 border-white/30 bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg shrink-0">
                      <School className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                  )}
                  <span className="text-[11px] sm:text-xs font-extrabold tracking-wider bg-amber-400/25 text-amber-200 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-amber-300/30 inline-flex items-center gap-1.5 w-fit shadow-xs">
                    <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                    ปีการศึกษา {currentAcademicYear}
                  </span>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug text-white">
                    ระบบลงเวลาปฏิบัติงานออนไลน์
                  </h1>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug text-purple-100">
                    {config.orgName}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-purple-200 font-medium mt-1 sm:mt-2 leading-relaxed opacity-95">
                  {config.orgAffiliation}
                </p>

                {/* Features Highlights - Hidden on small mobile to fit screen immediately, shown on tablet/desktop */}
                <div className="hidden md:block mt-6 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                    <KeyRound className="w-4 h-4 text-[#C4B5FD] shrink-0" />
                    <span>เข้าสู่ระบบด้วย Username & Password สะดวกและปลอดภัย</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                    <MapPin className="w-4 h-4 text-[#AED581] shrink-0" />
                    <span>ลงเวลาด้วยพิกัด GPS แม่นยำ รัศมี {config.radius} เมตร</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                    <Bluetooth className="w-4 h-4 text-[#FFCA28] shrink-0" />
                    <span>ผูกรหัส Bluetooth MAC ประจำเครื่อง ป้องกันลงเวลาแทนกัน</span>
                  </div>
                </div>
              </div>

              {/* Hardware Device Signature Info */}
              <div className="relative z-10 mt-4 sm:mt-6 pt-3 border-t border-white/15 text-[10px] sm:text-[11px] text-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bluetooth className="w-3.5 h-3.5 text-[#C4B5FD]" />
                  <span className="font-mono">{currentDeviceMac}</span>
                </div>
                <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full">{deviceLabel}</span>
              </div>
            </div>

            {/* Right Column: Teacher Login Form (Username & Password) */}
            <div className="md:col-span-7 p-5 sm:p-7 md:p-8 flex flex-col justify-center">
              <div className="mb-4 sm:mb-6 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-600" /> ปีการศึกษา {currentAcademicYear}
                  </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">เข้าสู่ระบบสำหรับครูและบุคลากร</h2>
              </div>

              {/* Login Form */}
              <form onSubmit={handleTeacherLogin} className="space-y-3 sm:space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>ชื่อผู้ใช้งาน (Username)</span>
                    <span className="text-[11px] text-slate-400 font-normal">เช่น kru_somchai</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="กรอกชื่อผู้ใช้งาน"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-100 text-sm bg-slate-50/50 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    </div>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="กรอกรหัสผ่าน"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 sm:pl-11 pr-11 sm:pr-12 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-100 text-sm bg-slate-50/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                      title={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Username */}
                <div className="flex flex-wrap items-center justify-between text-xs pt-0.5 sm:pt-1 gap-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberUsername}
                      onChange={(e) => setRememberUsername(e.target.checked)}
                      className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-slate-300"
                    />
                    <span>จดจำชื่อผู้ใช้งานในเครื่องนี้</span>
                  </label>
                  <span className="text-[10px] sm:text-[11px] text-slate-400">
                    เครื่อง: <b className="font-mono text-purple-900">{currentDeviceMac}</b>
                  </span>
                </div>

                {/* Submit Button */}
                <div className="pt-1.5 sm:pt-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white font-extrabold text-sm shadow-lg shadow-purple-800/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจสอบเข้าสู่ระบบ...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" /> เข้าสู่ระบบ (Sign In)
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Register link */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-100 flex items-center justify-end text-xs">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(true)}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-purple-50 text-[#7C3AED] font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-purple-200/60"
                >
                  <UserPlus className="w-4 h-4" /> ลงทะเบียนครูใหม่ (User & Password)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Footer */}
        <footer className="text-center py-2 sm:py-3 px-4 text-[10px] sm:text-xs font-semibold text-slate-500">
          ระบบลงเวลาปฏิบัติงานออนไลน์ {config.orgName} ประจำปีการศึกษา {currentAcademicYear} โดย รองฯภัทรธีระ ประทุมเม
        </footer>

        {/* Floating Action Button (Bottom Right) - Only Icon */}
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
          <button
            type="button"
            onClick={() => setAdminPinModalOpen(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center shadow-xl shadow-purple-900/30 hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white/80"
          >
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* Admin PIN Modal */}
        <AdminPinModal
          isOpen={adminPinModalOpen}
          onClose={() => setAdminPinModalOpen(false)}
          config={config}
          onSuccess={() => {
            const adminUser: UserAccount = {
              id: 'admin',
              fullname: 'ผู้ดูแลระบบ (Admin)',
              position: 'ผู้ดูแลระบบ',
              department: 'บริหารทั่วไป',
              role: 'admin',
              status: 'ACTIVE',
              username: 'admin'
            };
            setCurrentUser(adminUser);
            sessionStorage.setItem('attendance_active_user', JSON.stringify(adminUser));
            setCurrentTab('admin-dashboard');
            Swal.fire({
              title: 'เข้าสู่ระบบสำเร็จ',
              text: 'ยินดีต้อนรับ ผู้ดูแลระบบ (Admin)',
              icon: 'success',
              timer: 1400,
              showConfirmButton: false
            });
          }}
        />

        {/* Register Modal */}
        {registerModalOpen && (
          <RegisterModal
            isOpen={registerModalOpen}
            onClose={() => setRegisterModalOpen(false)}
            onSuccess={() => {}}
          />
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: AUTHENTICATED DASHBOARD (TEACHER & ADMIN)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80">
      {/* Navigation */}
      <Navigation
        user={currentUser}
        config={config}
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        onLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onClockAction={(action) => handleDirectClock(action)}
        onOpenLeaveModal={handleLeaveRequest}
        onOpenOfficialModal={handleOfficialDutyRequest}
        onOpenConfigModal={() => setConfigModalOpen(true)}
        onOpenUsersModal={() => setUsersModalOpen(true)}
        onOpenEditProfile={() => setEditProfileModalOpen(true)}
        onOpenHolidaysModal={() => setHolidaysModalOpen(true)}
        onOpenDeleteDataModal={() => setDeleteDataModalOpen(true)}
        gpsDistance={gpsDistance}
        gpsAccuracy={gpsAccuracy}
        onRefreshGps={() => refreshGpsLocation(true)}
      />

      {/* Main Layout */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-purple-100 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-xl text-slate-600 hover:bg-purple-50 lg:hidden cursor-pointer shrink-0"
              title="เปิดเมนู"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-[#7C3AED]" />
            </button>

            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt="Logo"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-xs border border-purple-200 hidden sm:block shrink-0"
                />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white flex items-center justify-center hidden sm:flex shadow-xs shrink-0">
                  <School className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-extrabold text-slate-800 leading-tight truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs md:max-w-md">
                  {config.orgName}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-purple-700 font-medium hidden sm:block truncate">
                  {config.orgAffiliation}
                </p>
              </div>
            </div>
          </div>

          {/* Live Location Status Indicator in Header (เห็นชัดเจน โดดเด่น) */}
          {currentUser.role !== 'admin' && (() => {
            const allowedRadius = config.radius || 150;
            const accuracyTolerance = Math.min((gpsAccuracy || 15) * 0.45, 25);
            const isInRadius = gpsDistance !== null && gpsDistance <= (allowedRadius + accuracyTolerance);
            return (
              <div
                onClick={() => refreshGpsLocation(true)}
                title="คลิกเพื่อปรับเทียบพิกัดดาวเทียม GPS"
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-black border transition-all cursor-pointer shadow-xs select-none ${
                  gpsDistance === null
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : isInRadius
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-300/60 hover:bg-emerald-600'
                    : 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30 ring-2 ring-rose-300/60 hover:bg-rose-600 animate-pulse'
                }`}
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {gpsDistance !== null && (
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isInRadius ? 'bg-emerald-200' : 'bg-rose-200'
                      }`}
                    />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      gpsDistance === null
                        ? 'bg-slate-400'
                        : 'bg-white'
                    }`}
                  />
                </span>
                <span className="text-[10px] sm:text-xs font-black truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                  {gpsDistance === null
                    ? 'กำลังตรวจจับพิกัด...'
                    : isInRadius
                    ? `อยู่ในรัศมี (${gpsDistance} ม.) ✓`
                    : `อยู่นอกพื้นที่ (${gpsDistance} ม.) ✕`}
                </span>
                {gpsAccuracy !== null && (
                  <span className="hidden sm:inline-block text-[10px] opacity-85 font-mono">
                    ±{gpsAccuracy}ม.
                  </span>
                )}
              </div>
            );
          })()}

          {/* User Profile Pill in Header */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div
              onClick={() => setEditProfileModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-purple-50 hover:bg-purple-100/70 border border-purple-200 transition-all cursor-pointer group"
            >
              <img
                src={
                  currentUser.img ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    currentUser.fullname
                  )}&background=8B5CF6&color=fff`
                }
                alt="Profile"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white shrink-0"
              />
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-[#7C3AED] truncate max-w-[80px] sm:max-w-[120px]">
                {currentUser.fullname.split(' ')[0]}
              </span>
              <span className="text-[9px] sm:text-[10px] bg-purple-200/80 text-purple-900 px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0">
                {currentUser.role === 'admin' ? 'Admin' : 'ครู'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 sm:p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Admin Navigation Ribbon */}
        {currentUser.role === 'admin' && (
          <div className="bg-white border-b border-purple-100 px-3 sm:px-6 lg:px-8 py-2 overflow-x-auto flex items-center gap-1.5 sm:gap-2 shadow-xs z-20">
            <button
              onClick={() => setCurrentTab('admin-dashboard')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                currentTab === 'admin-dashboard'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>ภาพรวมประจำวัน</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-summary')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                currentTab === 'admin-summary'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>สรุปรายบุคคล (เดือน)</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-map')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                currentTab === 'admin-map'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>แผนที่ดาวเทียม</span>
            </button>

            <button
              onClick={() => setUsersModalOpen(true)}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B5CF6]" />
              <span>จัดการสมาชิก/ครู</span>
            </button>

            <button
              onClick={() => setConfigModalOpen(true)}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B5CF6]" />
              <span>ตั้งค่าระบบ/ขอบเขต</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-logs')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                currentTab === 'admin-logs'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <FileClock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>ประวัติระบบ (Logs)</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {/* TEACHER HOME VIEW (Attendance Clocking Dashboard) */}
          {currentUser.role !== 'admin' && currentTab === 'home' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
              {/* Left Column: Clock & Teacher Profile Card */}
              <div className="lg:col-span-5 space-y-4 sm:space-y-6">
                <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[32px] overflow-hidden shadow-xl shadow-purple-950/5 border border-purple-100">
                  {/* Digital Clock Banner */}
                  <div className="bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#8B5CF6] p-5 sm:p-7 md:p-8 text-white text-center relative overflow-hidden">
                    <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-wide bg-white/20 text-purple-100 px-3 py-1 rounded-full border border-white/25 mb-2 sm:mb-3 backdrop-blur-md shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>เวลามาตรฐานอินเทอร์เน็ต (อัตโนมัติ)</span>
                    </div>
                    <div className="flex items-baseline justify-center font-mono font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight drop-shadow-md">
                      <span>{timeString.hourMin}</span>
                      <span className="text-xl sm:text-2xl md:text-3xl opacity-80 ml-1">:{timeString.sec}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-purple-100 font-semibold mt-1.5 sm:mt-2 opacity-95">
                      {thaiDateString}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="p-4 sm:p-6 text-center -mt-6 sm:-mt-8 relative z-10">
                    <div className="relative inline-block mb-2.5 sm:mb-3">
                      <img
                        src={
                          currentUser.img ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            currentUser.fullname
                          )}&background=8B5CF6&color=fff`
                        }
                        alt="Profile"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-white shadow-lg mx-auto bg-white"
                      />
                      <button
                        onClick={() => setEditProfileModalOpen(true)}
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#7C3AED] text-white shadow-md hover:bg-[#6D28D9] cursor-pointer"
                        title="แก้ไขข้อมูลส่วนตัว"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-base sm:text-lg font-extrabold text-slate-800">{currentUser.fullname}</h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                      {currentUser.position || 'ครูผู้สอน'} • {currentUser.department || 'ฝ่ายวิชาการ'}
                    </p>

                    {/* Bound Device Bluetooth MAC Info */}
                    <div className="mt-4 sm:mt-5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-purple-50/80 border border-purple-200/80 text-left text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bluetooth className="w-4 h-4 text-[#7C3AED] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Bluetooth MAC ที่ผูกไว้
                          </div>
                          <div className="font-mono font-bold text-purple-900 text-[11px] sm:text-xs truncate">
                            {currentUser.registeredMac || currentDeviceMac}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full shrink-0">
                        {deviceLabel}
                      </span>
                    </div>

                    {/* School Center Location & Radius Badge */}
                    <div className="mt-2 sm:mt-2.5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            จุดลงเวลาโรงเรียน
                          </div>
                          <div className="font-semibold text-slate-700 text-[11px] sm:text-xs truncate max-w-[130px] sm:max-w-[190px]">
                            {config.orgName}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
                        รัศมี {config.radius} ม.
                      </span>
                    </div>

                    </div>
                  </div>
                </div>

              {/* Right Column: Hero Location Status Banner + GPS Accuracy Status + 4 Action Cards + Recent History */}
              <div className="lg:col-span-7 space-y-4 sm:space-y-6">
                {/* HERO LOCATION & RADIUS STATUS BANNER (เห็นชัดเจน โดดเด่น) */}
                {(() => {
                  const allowedRadius = config.radius || 150;
                  const accuracyTolerance = Math.min((gpsAccuracy || 15) * 0.45, 25);
                  const isInRadius = gpsDistance !== null && gpsDistance <= (allowedRadius + accuracyTolerance);

                  if (gpsDistance === null) {
                    return (
                      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-100 border-2 border-slate-300 text-slate-700 flex items-center justify-between gap-3.5 shadow-sm">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-xs">
                            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                              กำลังตรวจจับพิกัดดาวเทียม GPS...
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                              กรุณารอสักครู่ ระบบกำลังคำนวณระยะห่างจาก {config.orgName}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => refreshGpsLocation(true)}
                          className="px-3.5 py-2 rounded-xl bg-white text-purple-700 hover:bg-purple-50 text-xs font-bold transition-all shadow-xs border border-purple-200 cursor-pointer shrink-0 flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                          <span>ปรับเทียบพิกัด</span>
                        </button>
                      </div>
                    );
                  }

                  if (isInRadius) {
                    /* อยู่ในรัศมีลงเวลา (INSIDE RADIUS - สีเขียวเด่นชัดเจน) */
                    return (
                      <div className="relative overflow-hidden p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-700/25 border-2 border-emerald-300">
                        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md" />
                              </div>
                              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-300 border-2 border-white"></span>
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="px-3 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] sm:text-xs font-black tracking-wide uppercase shadow-xs">
                                  ✓ อยู่ในรัศมีลงเวลา
                                </span>
                                <span className="text-[11px] sm:text-xs text-emerald-100 font-semibold bg-emerald-800/40 px-2.5 py-0.5 rounded-full">
                                  พร้อมลงเวลากลับ
                                </span>
                                {gpsAccuracy !== null && (
                                  <span className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                                    gpsAccuracy <= 15
                                      ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-400/50'
                                      : gpsAccuracy <= 30
                                      ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-400/40'
                                      : 'bg-orange-900/50 text-orange-200 border border-orange-400/40'
                                  }`}>
                                    {gpsAccuracy <= 15 ? '🟢 ดาวเทียมแม่นยำสูง' : gpsAccuracy <= 30 ? '🟡 สัญญาณดี' : '🟠 พิกัดกว้าง'} (±{gpsAccuracy}ม.)
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base sm:text-xl font-black text-white tracking-tight leading-tight">
                                อยู่ในรัศมีโรงเรียน พร้อมบันทึกเวลา
                              </h3>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100 mt-1">
                                <span>
                                  ระยะห่าง: <b className="text-white font-mono text-sm sm:text-base font-extrabold">{gpsDistance} เมตร</b> <span className="text-[11px] opacity-80">(กำหนดไม่เกิน {config.radius} ม.{gpsDistance > allowedRadius ? ` • ชดเชยคลาดเคลื่อน ±${Math.round(accuracyTolerance)}ม.` : ''})</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => refreshGpsLocation(true)}
                            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold transition-all border border-white/40 backdrop-blur-sm flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
                            title="ปรับเทียบพิกัดดาวเทียมใหม่เพื่อเพิ่มความแม่นยำ"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                            <span>ปรับเทียบพิกัดดาวเทียม</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  /* ไม่อยู่ในพื้นที่ (OUTSIDE AREA - สีแดงเด่นชัดเจน) */
                  return (
                    <div className="relative overflow-hidden p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white shadow-xl shadow-rose-700/30 border-2 border-rose-300">
                      <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md animate-pulse" />
                            </div>
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-400 border-2 border-white"></span>
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="px-3 py-0.5 rounded-full bg-white text-rose-900 text-[10px] sm:text-xs font-black tracking-wide uppercase shadow-xs">
                                ✕ ไม่อยู่ในพื้นที่
                              </span>
                              {gpsAccuracy !== null && (
                                <span className="text-[10px] sm:text-xs text-yellow-200 font-semibold bg-black/30 px-2.5 py-0.5 rounded-full">
                                  ความแม่นยำดาวเทียม: ±{gpsAccuracy} ม.
                                </span>
                              )}
                            </div>
                            <h3 className="text-base sm:text-xl font-black text-white tracking-tight leading-tight">
                              ไม่อยู่ในพื้นที่ (ไม่สามารถลงเวลาได้)
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-rose-100 mt-1">
                              <span>
                                ระยะห่างปัจจุบัน: <b className="text-yellow-200 font-mono text-sm sm:text-base font-extrabold">{gpsDistance} เมตร</b> <span className="text-[11px] opacity-90">(เกินรัศมี {config.radius} ม.)</span>
                              </span>
                            </div>
                            <div className="mt-2 text-[11px] text-yellow-100/90 bg-rose-950/40 p-2 rounded-lg border border-rose-400/30">
                              💡 แนะนำ: หากท่านอยู่ในโรงเรียนแล้วแต่พิกัดคลาดเคลื่อน ให้กดปุ่ม <b>"ปรับเทียบพิกัดดาวเทียม"</b> หรือเปิด Wi-Fi ควบคู่ GPS หรือออกสู่ที่โล่งแจ้งเพื่อช่วยให้อุปกรณ์ล็อกดาวเทียมได้แม่นยำยิ่งขึ้น
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => refreshGpsLocation(true)}
                          className="self-start md:self-center px-4 py-2.5 rounded-xl bg-white text-rose-900 hover:bg-rose-50 text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                          title="ปรับเทียบพิกัดดาวเทียมเดี๋ยวนี้"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                          <span>ปรับเทียบพิกัดดาวเทียม</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 4 Action Cards Grid (Direct Clock In/Out without Face Scanner) */}
                <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl lg:rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#7C3AED]" /> บันทึกเวลาปฏิบัติงานวันนี้
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const todayStr = getInternetIsoDate();
                        const hStatus = evaluateDayHolidayStatus(todayStr, holidaysMap);
                        if (hStatus.isSpecialOverride && !hStatus.isHoliday) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] sm:text-[11px] font-bold border border-blue-300">
                              ✓ {hStatus.holidayName || 'วันทำการพิเศษ'} (เปิดลงเวลา)
                            </span>
                          );
                        }
                        if (hStatus.isHoliday) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] sm:text-[11px] font-bold border border-rose-300">
                              วันหยุด: {hStatus.holidayName}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-[11px] font-bold border border-emerald-300">
                            วันทำการปกติ
                          </span>
                        );
                      })()}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                        <span>เวลาอินเทอร์เน็ต</span>
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-500 font-semibold">{thaiDateString}</span>
                    </div>
                  </div>

                  {(() => {
                    const allowedRadius = config.radius || 150;
                    const accuracyTolerance = Math.min((gpsAccuracy || 15) * 0.45, 25);
                    const isInRadius = gpsDistance !== null && gpsDistance <= (allowedRadius + accuracyTolerance);
                    const isOutsideArea = gpsDistance !== null && !isInRadius;

                    return (
                      <>

                        {/* 2. Check-Out Button (Bluetooth MAC + GPS) */}
                        <div
                          onClick={() => handleDirectClock('OUT')}
                          className={`p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl text-white flex items-center justify-between shadow-md sm:shadow-lg transition-all cursor-pointer group ${
                            todaySummary.leave || todaySummary.official
                              ? 'bg-slate-300 opacity-60 cursor-not-allowed'
                              : isOutsideArea
                              ? 'bg-gradient-to-r from-amber-600 via-orange-700 to-amber-700 ring-2 ring-rose-400 shadow-rose-900/20 hover:scale-[1.01]'
                              : 'bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 shadow-amber-700/20 ring-2 ring-amber-300/50 hover:scale-[1.01] hover:brightness-105'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                              <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm sm:text-base font-extrabold truncate">ลงเวลากลับ (OUT)</h4>
                              <p className="text-[10px] sm:text-xs text-amber-100 font-medium truncate">บันทึกเวลาสิ้นสุดงาน</p>
                              {isOutsideArea ? (
                                <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-rose-100 bg-rose-950/70 px-2 py-0.5 rounded-md mt-1 border border-rose-400/50">
                                  <AlertTriangle className="w-3 h-3 text-yellow-300 shrink-0" />
                                  <span>ไม่อยู่ในพื้นที่ ({gpsDistance} ม.) - เกินรัศมี {config.radius} ม.</span>
                                </div>
                              ) : gpsDistance !== null ? (
                                <div className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-100 bg-amber-950/40 px-2 py-0.5 rounded-md mt-1">
                                  <span>✓ อยู่ในรัศมีลงเวลา ({gpsDistance} ม.) พร้อมบันทึก</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-200 bg-black/20 px-2 py-0.5 rounded-md mt-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  <span>กำลังตรวจจับพิกัด...</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {todaySummary.leave || todaySummary.official ? (
                              <span className="text-[10px] sm:text-[11px] font-bold bg-black/20 text-white px-2 py-1 rounded-lg">
                                ล็อก (ลา)
                              </span>
                            ) : (
                              <div
                                className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold font-mono text-xs sm:text-sm shadow-xs ${
                                  todaySummary.out !== '--:--'
                                    ? 'bg-white text-amber-800'
                                    : 'bg-white/20 text-white border border-white/30'
                                }`}
                              >
                                {todaySummary.out}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}


                  {/* 3. Leave Request Button */}
                  <div
                    onClick={handleLeaveRequest}
                    className="p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl text-white flex items-center justify-between shadow-md sm:shadow-lg transition-all cursor-pointer group bg-gradient-to-r from-sky-500 via-blue-600 to-sky-600 shadow-blue-700/20 hover:scale-[1.01] hover:brightness-105"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <CalendarOff className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-extrabold truncate">แจ้งลาหยุดราชการ (LEAVE)</h4>
                        <p className="text-[10px] sm:text-xs text-sky-100 font-medium truncate">
                          {todaySummary.leave
                            ? `วันนี้: ${formatTableLeaveDisplay(todaySummary.leave)}`
                            : 'ลาป่วย / ลากิจ / ลาพักผ่อน (ออนไลน์)'}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      <div
                        className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-xs shadow-xs transition-transform group-hover:scale-105 ${
                          todaySummary.leave
                            ? 'bg-white text-sky-700'
                            : 'bg-white/20 text-white border border-white/30'
                        }`}
                      >
                        {todaySummary.leave ? 'บันทึกแล้ว' : 'แจ้งลา'}
                      </div>
                    </div>
                  </div>

                  {/* 4. Official Duty Button */}
                  <div
                    onClick={handleOfficialDutyRequest}
                    className="p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl text-white flex items-center justify-between shadow-md sm:shadow-lg transition-all cursor-pointer group bg-gradient-to-r from-purple-600 via-violet-700 to-indigo-600 shadow-purple-700/20 hover:scale-[1.01] hover:brightness-105"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-extrabold truncate">บันทึกไปราชการ (OFFICIAL)</h4>
                        <p className="text-[10px] sm:text-xs text-purple-100 font-medium truncate">
                          {todaySummary.official
                            ? `วันนี้: ${formatTableOfficialDisplay(todaySummary.official)}`
                            : 'ปฏิบัติงานนอกสถานที่ / อบรม / สัมมนา'}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      <div
                        className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-xs shadow-xs transition-transform group-hover:scale-105 ${
                          todaySummary.official
                            ? 'bg-white text-purple-800'
                            : 'bg-white/20 text-white border border-white/30'
                        }`}
                      >
                        {todaySummary.official ? 'บันทึกแล้ว' : 'ไปราชการ'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent History Table */}
                <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl lg:rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#7C3AED]" /> ประวัติการลงเวลาย้อนหลัง
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentTab('teacher-report')}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-purple-200"
                        title="ดูรายงานประจำเดือนและพิมพ์เอกสาร"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">รายงานประจำเดือน (พิมพ์)</span>
                        <span className="sm:hidden">รายงาน</span>
                      </button>
                      <button
                        onClick={() => fetchUserAttendance(currentUser.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#7C3AED] transition-colors cursor-pointer"
                        title="รีเฟรชข้อมูล"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="py-6 sm:py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                      <p className="text-xs">กำลังโหลดประวัติ...</p>
                    </div>
                  ) : userHistory.length === 0 ? (
                    <div className="py-6 sm:py-8 text-center text-slate-400">
                      <Clock className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">ยังไม่มีรายการลงเวลาในระบบ</p>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {userHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 hover:bg-purple-50/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 font-bold text-xs ${
                                item.action === 'IN'
                                  ? 'bg-emerald-500'
                                  : item.action === 'OUT'
                                  ? 'bg-amber-500'
                                  : item.action === 'LEAVE'
                                  ? 'bg-sky-500'
                                  : 'bg-purple-600'
                              }`}
                            >
                              {item.action === 'IN' ? 'IN' : item.action === 'OUT' ? 'OUT' : 'L'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-800 truncate">
                                {item.action === 'IN'
                                  ? 'ลงเวลาเข้างาน'
                                  : item.action === 'OUT'
                                  ? 'ลงเวลากลับ'
                                  : item.action === 'LEAVE'
                                  ? 'แจ้งลาหยุด'
                                  : 'ไปราชการ'}
                                {item.note && (
                                  <span className="text-slate-500 font-normal ml-1">
                                    ({item.action === 'LEAVE'
                                      ? formatTableLeaveDisplay(item.note)
                                      : item.action === 'OFFICIAL'
                                      ? formatTableOfficialDisplay(item.note)
                                      : item.note})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                                {item.dateThai || item.date}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs sm:text-sm text-slate-800">{item.time} น.</div>
                            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                              สำเร็จ
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TEACHER DASHBOARD VIEW */}
          {currentUser.role !== 'admin' && currentTab === 'teacher-dashboard' && (
            <TeacherDashboard
              user={currentUser}
              config={config}
              onSelectTab={(tab) => setCurrentTab(tab as any)}
              onClockAction={(action) => handleDirectClock(action)}
              onOpenLeaveModal={handleLeaveRequest}
              onOpenOfficialModal={handleOfficialDutyRequest}
              onOpenEditProfile={() => setEditProfileModalOpen(true)}
            />
          )}

          {/* TEACHER REPORT VIEW */}
          {currentUser.role !== 'admin' && currentTab === 'teacher-report' && (
            <TeacherReport user={currentUser} config={config} />
          )}

          {/* ADMIN MANAGEMENT DASHBOARD */}
          {currentUser.role === 'admin' && (
            <AdminReports
              user={currentUser}
              config={config}
              activeView={currentTab.startsWith('admin-') ? currentTab.replace('admin-', '') as any : 'dashboard'}
              selectedDate={selectedAdminDate}
              onDateChange={setSelectedAdminDate}
              selectedMonth={selectedAdminMonth}
              onMonthChange={setSelectedAdminMonth}
              onOpenHolidaysModal={() => setHolidaysModalOpen(true)}
              onOpenDeleteDataModal={() => setDeleteDataModalOpen(true)}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="text-center py-4 sm:py-6 px-3 text-[11px] sm:text-xs font-semibold text-slate-400 border-t border-purple-100 bg-white/60">
          ระบบลงเวลาปฏิบัติงานออนไลน์ {config.orgName} โดย รองฯภัทรธีระ ประทุมเม
        </footer>
      </div>

      {/* MODALS */}
      {/* 1. Edit Profile Modal */}
      {editProfileModalOpen && (
        <EditProfileModal
          user={currentUser}
          isOpen={editProfileModalOpen}
          onClose={() => setEditProfileModalOpen(false)}
          onSuccess={(updated) => {
            setCurrentUser(updated);
            sessionStorage.setItem('attendance_active_user', JSON.stringify(updated));
          }}
        />
      )}

      {/* 2. Admin Config Modal */}
      {configModalOpen && (
        <AdminConfigModal
          config={config}
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          onSuccess={(newCfg) => setConfig(newCfg)}
        />
      )}

      {/* 3. Admin Users Modal */}
      {usersModalOpen && (
        <AdminUsersModal
          isOpen={usersModalOpen}
          onClose={() => setUsersModalOpen(false)}
          onOpenRegister={() => setRegisterModalOpen(true)}
          currentAdminUsername={currentUser?.username || 'admin'}
        />
      )}

      {/* 4. Register Modal */}
      {registerModalOpen && (
        <RegisterModal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          onSuccess={() => {}}
        />
      )}

      {/* 5. Admin Holidays Modal */}
      {holidaysModalOpen && (
        <AdminHolidaysModal
          isOpen={holidaysModalOpen}
          onClose={() => setHolidaysModalOpen(false)}
          adminUsername={currentUser?.username || 'admin'}
          onHolidaysChange={(updatedMap) => setHolidaysMap(updatedMap)}
        />
      )}

      {/* 6. Admin Delete Data Modal */}
      {deleteDataModalOpen && (
        <AdminDeleteDataModal
          isOpen={deleteDataModalOpen}
          onClose={() => setDeleteDataModalOpen(false)}
          adminUsername={currentUser?.username || 'admin'}
          config={config}
          onDataDeleted={() => {
            if (currentUser) {
              fetchUserAttendance(currentUser.id);
            }
          }}
        />
      )}

      {/* 7. Teacher Leave Modal */}
      {leaveModalOpen && currentUser && (
        <TeacherLeaveModal
          isOpen={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          user={currentUser}
          currentDeviceMac={currentDeviceMac}
          onSuccess={() => fetchUserAttendance(currentUser.id)}
        />
      )}

      {/* 8. Teacher Official Duty Modal */}
      {officialModalOpen && currentUser && (
        <TeacherOfficialModal
          isOpen={officialModalOpen}
          onClose={() => setOfficialModalOpen(false)}
          user={currentUser}
          currentDeviceMac={currentDeviceMac}
          onSuccess={() => fetchUserAttendance(currentUser.id)}
        />
      )}
    </div>
  );
}
