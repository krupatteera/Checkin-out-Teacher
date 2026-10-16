import React, { useState, useEffect, useRef } from 'react';
import {
  School,
  Lock,
  User,
  KeyRound,
  ShieldCheck,
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
  Camera,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  Settings,
  FileClock,
  Bluetooth,
  Upload,
  Loader2,
  Check
} from 'lucide-react';
import { SchoolConfig, UserAccount, AttendanceRecord } from './types';
import {
  getSchoolConfig,
  findUserByUsername,
  registerNewUser,
  getUserStatusToday,
  getUserRecentHistory,
  saveAttendanceRecord,
  getAllUsersList,
  DEFAULT_CONFIG
} from './firebase';
import { getOrGenerateBluetoothMac, getDeviceInfoLabel } from './utils/deviceMac';
import { Swal } from './utils/sweetAlert';
import { identifyUserByFace } from './utils/aiFace';
import { compressImageBase64 } from './utils/imageUtils';
import { RegisterModal } from './components/RegisterModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AdminConfigModal } from './components/AdminConfigModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AdminReports } from './components/AdminReports';
import { Navigation } from './components/Navigation';

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
  const [currentTab, setCurrentTab] = useState<'home' | 'admin-dashboard' | 'admin-summary' | 'admin-map' | 'admin-logs'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Attendance user data (Teachers only)
  const [todaySummary, setTodaySummary] = useState({ in: '--:--', out: '--:--', leave: '', official: '' });
  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Real-time GPS tracker state
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Face Login (Live Camera AI) state for teachers - No photo upload
  const [faceOvalStatus, setFaceOvalStatus] = useState<'idle' | 'scanning' | 'matched' | 'unmatched'>('idle');
  const [faceLoginStatusText, setFaceLoginStatusText] = useState('จัดใบหน้าให้อยู่ในกรอบวงรีเพื่อเข้าสู่ระบบ');
  const [faceLoginCameraActive, setFaceLoginCameraActive] = useState(false);
  const [faceLoginCameraError, setFaceLoginCameraError] = useState<string | null>(null);
  const isScanningRef = useRef(false);
  const loginVideoRef = useRef<HTMLVideoElement>(null);
  const loginStreamRef = useRef<MediaStream | null>(null);

  // Current real-time clock
  const [timeString, setTimeString] = useState({ hourMin: '00:00', sec: '00' });
  const [thaiDateString, setThaiDateString] = useState('');

  // Modals state
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);

  // Admin filter dates
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedAdminDate, setSelectedAdminDate] = useState(todayIso);
  const currentMonthIso = todayIso.substring(0, 7);
  const [selectedAdminMonth, setSelectedAdminMonth] = useState(currentMonthIso);

  // Device Bluetooth MAC Address
  const currentDeviceMac = getOrGenerateBluetoothMac();
  const deviceLabel = getDeviceInfoLabel();

  // Clock runner
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const fullTime = now.toLocaleTimeString('th-TH', { hour12: false });
      const parts = fullTime.split(':');
      setTimeString({
        hourMin: `${parts[0] || '00'}:${parts[1] || '00'}`,
        sec: parts[2] || '00'
      });

      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
      const dateText = `${thaiDays[now.getDay()]}ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} พ.ศ. ${now.getFullYear() + 543}`;
      setThaiDateString(dateText);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial school config & check default admin
  useEffect(() => {
    const initApp = async () => {
      try {
        const loadedConfig = await getSchoolConfig();
        setConfig(loadedConfig);

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

  // Ensure Admin never lands on teacher clock-in view
  useEffect(() => {
    if (currentUser?.role === 'admin' && currentTab === 'home') {
      setCurrentTab('admin-dashboard');
    }
  }, [currentUser, currentTab]);

  // GPS Accuracy Tracker: continuously refresh GPS when teacher is on home screen
  const refreshGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('เบราว์เซอร์ไม่รองรับ GPS');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 15);
        setGpsCoords({ lat, lng });
        setGpsAccuracy(acc);
        setGpsError(null);

        const centerLat = config.centerLat || 17.413840;
        const centerLng = config.centerLng || 102.787260;
        const dist = calculateDistanceMeters(lat, lng, centerLat, centerLng);
        setGpsDistance(dist);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGpsLoading(false);
        setGpsError('ไม่สามารถดึงพิกัด GPS ได้ กรุณาเปิดสิทธิ์การเข้าถึงตำแหน่ง');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      }
    );
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && currentTab === 'home') {
      refreshGpsLocation();
      const interval = setInterval(refreshGpsLocation, 12000);
      return () => clearInterval(interval);
    }
  }, [currentUser, currentTab, config]);

  // Fetch user attendance status
  const fetchUserAttendance = async (userId: string) => {
    setHistoryLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
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
  // CAMERA & CONTINUOUS AI FACE LOGIN LOGIC (NO PHOTO UPLOAD)
  // --------------------------------------------------------------------------
  const stopLoginCamera = () => {
    if (loginStreamRef.current) {
      loginStreamRef.current.getTracks().forEach((track) => track.stop());
      loginStreamRef.current = null;
    }
    setFaceLoginCameraActive(false);
  };

  const startLoginCamera = async () => {
    setFaceLoginCameraError(null);
    try {
      stopLoginCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 }
        },
        audio: false
      });
      loginStreamRef.current = stream;
      if (loginVideoRef.current) {
        loginVideoRef.current.srcObject = stream;
      }
      setFaceLoginCameraActive(true);
      setFaceOvalStatus('idle');
      setFaceLoginStatusText('จัดใบหน้าให้อยู่ในกรอบวงรีเพื่อเข้าสู่ระบบ');
    } catch (err) {
      console.error('Camera access error:', err);
      setFaceLoginCameraError('ไม่สามารถเข้าถึงกล้องหน้าได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์เพื่อเข้าสู่ระบบ');
      setFaceLoginCameraActive(false);
    }
  };

  useEffect(() => {
    if (!currentUser && !registerModalOpen && !adminPinModalOpen) {
      startLoginCamera();
    } else {
      stopLoginCamera();
    }
    return () => {
      stopLoginCamera();
    };
  }, [currentUser, registerModalOpen, adminPinModalOpen]);

  // Teacher AI Face Verification
  // If matched -> oval turns GREEN and automatically enters system!
  // If unmatched -> oval turns RED and prompts to move camera until green!
  const handlePerformFaceLogin = async (isManualClick = false) => {
    if (isScanningRef.current || faceOvalStatus === 'matched') return;

    const video = loginVideoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      if (isManualClick) {
        setFaceLoginStatusText('กรุณารอสักครู่ให้กล้องเปิดทำงานให้พร้อม...');
      }
      return;
    }

    isScanningRef.current = true;
    setFaceOvalStatus('scanning');
    setFaceLoginStatusText('AI กำลังวิเคราะห์โครงหน้าชีวภาพและตรวจสอบกับฐานข้อมูล...');

    try {
      const vw = video.videoWidth || 480;
      const vh = video.videoHeight || 480;
      const cropSize = Math.min(vw, vh);
      const sx = (vw - cropSize) / 2;
      const sy = (vh - cropSize) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = 440;
      canvas.height = 440;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isScanningRef.current = false;
        setFaceOvalStatus('idle');
        return;
      }

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
      const imageToAnalyze = canvas.toDataURL('image/jpeg', 0.85);

      const allUsers = await getAllUsersList();
      const teacherCandidates = allUsers.filter((u) => u.role !== 'admin' && Boolean(u.img));

      if (teacherCandidates.length === 0) {
        setFaceOvalStatus('unmatched');
        setFaceLoginStatusText('ยังไม่มีฐานข้อมูลครูในระบบ กรุณากด "เมนูลงทะเบียน" ด้านล่าง');
        if (isManualClick) {
          Swal.fire({
            title: 'ยังไม่มีฐานข้อมูลครู',
            text: 'ยังไม่พบรายชื่อครูในระบบ กรุณากดปุ่ม "เมนูลงทะเบียน" เพื่อลงทะเบียนใบหน้าแรกของท่าน',
            icon: 'info',
            confirmButtonColor: '#7C3AED'
          });
        }
        isScanningRef.current = false;
        return;
      }

      const matchResult = await identifyUserByFace(imageToAnalyze, teacherCandidates);

      if (matchResult.matchedUser) {
        const foundUser = matchResult.matchedUser;

        // 1. MATCHED: OVAL TURNS GREEN!
        setFaceOvalStatus('matched');
        setFaceLoginStatusText(`✓ ตรวจสอบผ่าน! ใบหน้าตรงกับ คุณ ${foundUser.fullname} กำลังเข้าระบบอัตโนมัติ...`);

        // Check user approval status
        if (foundUser.status === 'PENDING') {
          isScanningRef.current = false;
          Swal.fire({
            title: 'รอการอนุมัติจากผู้ดูแลระบบ',
            html: `
              <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
                <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                  <p class="font-bold flex items-center gap-1.5 text-xs">
                    <span>⏳ บัญชีอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ</span>
                  </p>
                  <p class="mt-1 text-[11px] leading-relaxed">
                    ตรวจพบใบหน้าของคุณ: <b>${foundUser.fullname}</b><br>
                    ขณะนี้บัญชียังอยู่ในสถานะรอผู้ดูแลระบบตรวจสอบ กรุณาแจ้งผู้ดูแลระบบเพื่ออนุมัติการใช้งานก่อนเข้าสู่ระบบ
                  </p>
                </div>
              </div>
            `,
            icon: 'info',
            confirmButtonColor: '#7C3AED',
            confirmButtonText: 'รับทราบ'
          });
          return;
        }

        if (foundUser.status === 'INACTIVE') {
          isScanningRef.current = false;
          Swal.fire('บัญชีถูกระงับ', 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 'warning');
          return;
        }

        // Check / Bind Bluetooth MAC Address
        if (!foundUser.registeredMac) {
          foundUser.registeredMac = currentDeviceMac;
        } else if (foundUser.registeredMac !== currentDeviceMac) {
          console.warn('Device MAC differs from registered MAC, proceeding with Face ID verification.');
        }

        // Brief delay so teacher clearly sees the green oval transition!
        await new Promise((resolve) => setTimeout(resolve, 650));

        stopLoginCamera();
        setCurrentUser(foundUser);
        sessionStorage.setItem('attendance_active_user', JSON.stringify(foundUser));

        await Swal.fire({
          title: 'เข้าสู่ระบบสำเร็จ!',
          html: `
            <div class="text-center text-xs text-slate-600 space-y-2">
              <p class="font-bold text-slate-800 text-sm">ยินดีต้อนรับ คุณ ${foundUser.fullname}</p>
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> AI Face Verified (${matchResult.confidenceScore}%)
              </div>
            </div>
          `,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });

        fetchUserAttendance(foundUser.id);
        setCurrentTab('home');
      } else {
        // 2. NOT MATCHED: OVAL TURNS RED!
        // No blocking modal popup so the user can continuously adjust camera!
        setFaceOvalStatus('unmatched');
        setFaceLoginStatusText('⚠️ ภาพไม่ตรงกับที่ลงทะเบียน กรุณาขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว');
      }
    } catch (err) {
      console.error('Face verification error:', err);
      setFaceOvalStatus('unmatched');
      setFaceLoginStatusText('⚠️ กำลังค้นหาใบหน้า... กรุณาขยับกล้องเรื่อยๆ ให้อยู่ตรงกลาง');
    } finally {
      isScanningRef.current = false;
    }
  };

  // Continuous Auto-Scan Loop: Every 2 seconds while camera is streaming and not yet logged in
  useEffect(() => {
    if (currentUser || registerModalOpen || adminPinModalOpen || !faceLoginCameraActive) {
      return;
    }

    let isMounted = true;
    const interval = setInterval(async () => {
      if (!isMounted || isScanningRef.current || faceOvalStatus === 'matched') {
        return;
      }
      await handlePerformFaceLogin(false);
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser, registerModalOpen, adminPinModalOpen, faceLoginCameraActive, faceOvalStatus]);

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

    // Check duplicate check-in
    if (action === 'IN' && todaySummary.in !== '--:--') {
      Swal.fire('ลงเวลาเข้างานแล้ว', `คุณได้ลงเวลาเข้างานไปแล้วเมื่อ ${todaySummary.in} น.`, 'info');
      return;
    }

    // Check check-out constraints
    if (action === 'OUT') {
      if (todaySummary.in === '--:--') {
        Swal.fire('ไม่อนุญาตให้ลงเวลากลับ', 'กรุณากด "ลงเวลาเข้างาน" ให้เรียบร้อยก่อนลงเวลากลับ', 'warning');
        return;
      }
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
    if (!gpsCoords || gpsDistance === null) {
      Swal.fire({
        title: 'กำลังค้นหาพิกัด GPS',
        text: 'ระบบกำลังดึงพิกัดดาวเทียม กรุณารอสักครู่หรือกดปุ่ม "รีเฟรชพิกัด" ด้านบน',
        icon: 'info',
        confirmButtonColor: '#7C3AED'
      });
      refreshGpsLocation();
      return;
    }

    const allowedRadius = config.radius || 150;
    if (gpsDistance > allowedRadius) {
      Swal.fire({
        title: 'อยู่นอกพื้นที่โรงเรียน!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold">ท่านอยู่ห่างจากโรงเรียนเกินระยะที่กำหนด</p>
            <div class="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
              <p>ระยะห่างปัจจุบัน: <b>${gpsDistance} เมตร</b></p>
              <p>รัศมีที่อนุญาต: <b>ไม่เกิน ${allowedRadius} เมตร</b></p>
              <p class="text-[10px] text-slate-500 mt-1">ความแม่นยำพิกัด: ±${gpsAccuracy || 15} ม.</p>
            </div>
            <p class="text-[11px] text-slate-500">กรุณาเข้าสู่บริเวณพื้นที่ ${config.orgName} ก่อนทำการลงเวลา</p>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    // 4. Save Attendance Record directly with GPS + Bluetooth MAC
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const isLate = Boolean(action === 'IN' && config.lateTime && timeStr > config.lateTime);
    const isEarly = Boolean(action === 'OUT' && config.earlyTime && timeStr < config.earlyTime);

    let finalNote = '';
    if (isLate) finalNote = 'เข้าสาย';
    if (isEarly) finalNote = 'กลับก่อนเวลา';

    try {
      await saveAttendanceRecord({
        userId: currentUser.id,
        employeeId: currentUser.username || currentUser.id,
        employeeName: currentUser.fullname,
        action,
        date: dateStr,
        dateThai: thaiDateString,
        time: timeStr,
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        distance: gpsDistance,
        isLate,
        isEarly,
        note: finalNote,
        macAddress: currentDeviceMac,
        timestamp: now.getTime()
      });

      await Swal.fire({
        title: action === 'IN' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลากลับสำเร็จ!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <p class="text-sm font-bold text-purple-900">เวลา: ${timeStr} น. ${isLate ? '<span class="text-rose-600 font-bold">(เข้าสาย)</span>' : ''} ${isEarly ? '<span class="text-amber-600 font-bold">(กลับก่อนเวลา)</span>' : ''}</p>
              <p class="text-[11px] text-slate-500 mt-1">พิกัด GPS: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)} (ห่าง ร.ร. ${gpsDistance} ม.)</p>
              <p class="text-[11px] font-mono text-purple-800 mt-0.5">Bluetooth MAC: ${currentDeviceMac}</p>
            </div>
            <p class="text-[10px] text-emerald-700 font-bold">✓ บันทึกเวลาด้วยพิกัด GPS และ Bluetooth MAC เรียบร้อยแล้ว</p>
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
  // LEAVE & OFFICIAL DUTY HANDLERS (MUTUAL EXCLUSION CHECK)
  // When already clocked in/out today -> CANNOT LEAVE OR OFFICIAL!
  // --------------------------------------------------------------------------
  const handleLeaveRequest = async () => {
    if (!currentUser || currentUser.role === 'admin') return;

    // Mutual exclusion check: If already clocked in or clocked out today -> CANNOT REQUEST LEAVE!
    if (todaySummary.in !== '--:--' || todaySummary.out !== '--:--') {
      Swal.fire({
        title: 'ไม่สามารถแจ้งลาหยุดได้',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold">คุณได้ลงเวลาปฏิบัติงานในวันนี้ไปแล้ว</p>
            <p>เวลาเข้างาน: <b>${todaySummary.in} น.</b></p>
            <p class="text-[11px] text-slate-500">
              ตามระเบียบของระบบ เมื่อมีการลงเวลาปฏิบัติงานในวันดังกล่าวแล้ว จะไม่สามารถแจ้งลาหยุดหรือไปราชการได้
            </p>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    if (todaySummary.leave) {
      Swal.fire('แจ้งลาแล้ว', 'วันนี้คุณได้ทำการแจ้งลาหยุดไปแล้ว', 'info');
      return;
    }

    const leaveType = prompt('เลือกประเภทการลา (ลาป่วย / ลากิจ / ลาพักผ่อน / อื่นๆ):', 'ลากิจ');
    if (!leaveType) return;

    const leaveReason = prompt('ระบุเหตุผลการลา:', 'ทำธุระส่วนตัว');
    if (!leaveReason) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });

    try {
      await saveAttendanceRecord({
        userId: currentUser.id,
        employeeId: currentUser.username || currentUser.id,
        employeeName: currentUser.fullname,
        action: 'LEAVE',
        date: dateStr,
        dateThai: thaiDateString,
        time: timeStr,
        note: `${leaveType} (${leaveReason})`,
        macAddress: currentDeviceMac,
        timestamp: now.getTime()
      });

      Swal.fire('สำเร็จ', 'บันทึกข้อมูลการลาหยุดเรียบร้อยแล้ว', 'success');
      fetchUserAttendance(currentUser.id);
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleOfficialDutyRequest = async () => {
    if (!currentUser || currentUser.role === 'admin') return;

    // Mutual exclusion check: If already clocked in or clocked out today -> CANNOT GO OFFICIAL!
    if (todaySummary.in !== '--:--' || todaySummary.out !== '--:--') {
      Swal.fire({
        title: 'ไม่สามารถบันทึกไปราชการได้',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold">คุณได้ลงเวลาปฏิบัติงานในวันนี้ไปแล้ว</p>
            <p>เวลาเข้างาน: <b>${todaySummary.in} น.</b></p>
            <p class="text-[11px] text-slate-500">
              ตามระเบียบของระบบ เมื่อมีการลงเวลาปฏิบัติงานในวันดังกล่าวแล้ว จะไม่สามารถบันทึกไปราชการหรือแจ้งลาได้
            </p>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    if (todaySummary.official) {
      Swal.fire('บันทึกแล้ว', 'วันนี้คุณได้บันทึกไปราชการไปแล้ว', 'info');
      return;
    }

    const detail = prompt('ระบุรายละเอียดการไปราชการ (เช่น ประชุม / อบรม / นิเทศ):', 'ประชุมราชการ');
    if (!detail) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });

    try {
      await saveAttendanceRecord({
        userId: currentUser.id,
        employeeId: currentUser.username || currentUser.id,
        employeeName: currentUser.fullname,
        action: 'OFFICIAL',
        date: dateStr,
        dateThai: thaiDateString,
        time: timeStr,
        note: detail,
        macAddress: currentDeviceMac,
        timestamp: now.getTime()
      });

      Swal.fire('สำเร็จ', 'บันทึกข้อมูลการไปราชการเรียบร้อยแล้ว', 'success');
      fetchUserAttendance(currentUser.id);
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: TEACHER FACE LOGIN + FLOATING ADMIN PIN BUTTON (WHEN LOGGED OUT)
  // --------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-purple-50/40 to-slate-100 p-4 sm:p-6 lg:p-10 relative">
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-purple-950/10 border border-purple-100 overflow-hidden grid grid-cols-1 md:grid-cols-12 transition-all">
            {/* Left Column: School Info & Branding */}
            <div className="md:col-span-5 bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#8B5CF6] p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#C4B5FD]/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#8B5CF6]/25 blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  {config.logoUrl ? (
                    <img
                      src={config.logoUrl}
                      alt="Logo"
                      className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white/30 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg">
                      <School className="w-9 h-9" />
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] font-bold tracking-wider uppercase bg-white/20 text-purple-100 px-3 py-1 rounded-full border border-white/20">
                      ระบบลงเวลาปฏิบัติงานออนไลน์
                    </span>
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
                  {config.orgName}
                </h1>
                <p className="text-xs sm:text-sm text-purple-100 font-medium mt-2 leading-relaxed opacity-95">
                  {config.orgAffiliation}
                </p>

                <div className="mt-8 space-y-3 text-xs">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <Camera className="w-5 h-5 text-[#C4B5FD] shrink-0" />
                    <span>เข้าสู่ระบบด้วยการสแกนใบหน้า (AI Face Login)</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <MapPin className="w-5 h-5 text-[#AED581] shrink-0" />
                    <span>ลงเวลาด้วยพิกัด GPS แม่นยำ รัศมี {config.radius} เมตร</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <Bluetooth className="w-5 h-5 text-[#FFCA28] shrink-0" />
                    <span>ผูกรหัส Bluetooth MAC ประจำเครื่อง ป้องกันลงเวลาแทนกัน</span>
                  </div>
                </div>
              </div>

              {/* Hardware Device Signature Info */}
              <div className="relative z-10 mt-8 pt-4 border-t border-white/15 text-[11px] text-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-4 h-4 text-[#C4B5FD]" />
                  <span className="font-mono">{currentDeviceMac}</span>
                </div>
                <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full">{deviceLabel}</span>
              </div>
            </div>

            {/* Right Column: AI Face Login Screen (No User/Pass! Live Camera Only!) */}
            <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
              <div className="mb-4 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-[#7C3AED] text-xs font-bold mb-2 border border-purple-200">
                  <Sparkles className="w-3.5 h-3.5" /> ระบบล็อกอินด้วยการสแกนใบหน้า AI อัตโนมัติ
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800">เข้าสู่ระบบสำหรับครู</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  หันหน้าตรงเข้าหากล้อง ระบบ AI จะสแกนอัตโนมัติ เมื่อวงรีเป็น<b>สีเขียว</b>จะเข้าระบบทันที (หากขึ้น<b>สีแดง</b>ให้ขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว)
                </p>
              </div>

              {/* Live Status Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#7C3AED]" /> กล้องหน้าสด (AI Live Recognition)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  สแกนอัตโนมัติ
                </span>
              </div>

              {/* Face Scanner Viewport with Dynamic Green / Red Border */}
              <div
                className={`relative w-full aspect-square max-w-[280px] sm:max-w-[310px] mx-auto rounded-3xl overflow-hidden bg-slate-900 border-4 shadow-xl flex items-center justify-center transition-all duration-300 ${
                  faceOvalStatus === 'matched'
                    ? 'border-emerald-500 ring-4 ring-emerald-300 shadow-emerald-500/30'
                    : faceOvalStatus === 'unmatched'
                    ? 'border-rose-500 ring-4 ring-rose-300 shadow-rose-500/30'
                    : faceOvalStatus === 'scanning'
                    ? 'border-purple-400 ring-2 ring-purple-300 shadow-purple-500/20'
                    : 'border-purple-200'
                }`}
              >
                {faceLoginCameraError ? (
                  <div className="p-4 text-center text-white">
                    <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                    <p className="text-xs font-medium mb-3">{faceLoginCameraError}</p>
                    <button
                      type="button"
                      onClick={startLoginCamera}
                      className="px-3.5 py-1.5 bg-[#7C3AED] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      เปิดกล้องใหม่อีกครั้ง
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={loginVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />

                    {/* Central Oval Alignment Guide: Green when matched, Red when unmatched, pulsing while adjusting */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`w-44 sm:w-48 h-60 sm:h-64 rounded-[50%] flex flex-col items-center justify-center transition-all duration-300 relative ${
                          faceOvalStatus === 'matched'
                            ? 'border-4 border-emerald-400 bg-emerald-500/20 shadow-[0_0_35px_rgba(52,211,153,0.9)] scale-105'
                            : faceOvalStatus === 'unmatched'
                            ? 'border-4 border-rose-500 bg-rose-500/20 shadow-[0_0_35px_rgba(244,63,94,0.9)] animate-pulse'
                            : faceOvalStatus === 'scanning'
                            ? 'border-3 border-[#8B5CF6] bg-[#7C3AED]/15 shadow-[0_0_20px_rgba(139,92,246,0.6)]'
                            : 'border-2 border-dashed border-[#A78BFA] bg-black/20 shadow-[0_0_15px_rgba(167,139,250,0.4)]'
                        }`}
                      >
                        {/* Status feedback badge inside oval */}
                        {faceOvalStatus === 'matched' ? (
                          <div className="flex flex-col items-center animate-bounce">
                            <CheckCircle2 className="w-12 h-12 text-emerald-300 drop-shadow-md mb-1" />
                            <span className="text-[11px] font-bold text-white px-3 py-1 bg-emerald-600 rounded-full shadow-lg">
                              ✓ ผ่าน (กำลังเข้าระบบ)
                            </span>
                          </div>
                        ) : faceOvalStatus === 'unmatched' ? (
                          <div className="flex flex-col items-center">
                            <AlertCircle className="w-9 h-9 text-rose-300 drop-shadow-md mb-1" />
                            <span className="text-[10px] font-bold text-white px-2.5 py-0.5 bg-rose-600/95 rounded-full shadow-lg text-center leading-tight">
                              ภาพไม่ตรงกัน<br />ขยับกล้องเรื่อยๆ
                            </span>
                          </div>
                        ) : faceOvalStatus === 'scanning' ? (
                          <div className="flex flex-col items-center">
                            <Loader2 className="w-8 h-8 text-purple-200 animate-spin mb-1" />
                            <span className="text-[10px] font-medium text-white px-2.5 py-0.5 bg-purple-900/70 rounded-full">
                              AI กำลังตรวจสอบ...
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-purple-200 font-medium px-2.5 py-1 bg-black/50 rounded-full backdrop-blur-xs">
                            จัดใบหน้าในกรอบวงรี
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Status Hint with Dynamic Colors */}
              <div className="mt-3.5 text-center px-1">
                {faceOvalStatus === 'matched' ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-300 shadow-sm animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{faceLoginStatusText}</span>
                  </div>
                ) : faceOvalStatus === 'unmatched' ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-300 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{faceLoginStatusText}</span>
                  </div>
                ) : faceOvalStatus === 'scanning' ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-purple-50 text-[#7C3AED] text-xs font-bold border border-purple-200">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED] shrink-0" />
                    <span>{faceLoginStatusText}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>{faceLoginStatusText}</span>
                  </div>
                )}
              </div>

              {/* Scan Face to Login CTA Button */}
              <div className="mt-4">
                <button
                  type="button"
                  disabled={faceOvalStatus === 'scanning' || faceOvalStatus === 'matched' || !faceLoginCameraActive}
                  onClick={() => handlePerformFaceLogin(true)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-extrabold text-sm shadow-lg shadow-purple-800/25 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {faceOvalStatus === 'scanning' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> AI กำลังวิเคราะห์ใบหน้า...
                    </>
                  ) : faceOvalStatus === 'matched' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-300" /> เข้าสู่ระบบสำเร็จ...
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" /> ตรวจสอบใบหน้าทันที (หรือรอระบบตรวจจับอัตโนมัติ)
                    </>
                  )}
                </button>
              </div>

              {/* Register link */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                <span className="text-slate-500">ครูใหม่ หรือยังไม่เคยลงทะเบียนใบหน้า?</span>
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-50 text-[#7C3AED] font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-purple-200/60"
                >
                  <UserPlus className="w-4 h-4" /> เมนูลงทะเบียน (จดจำเครื่องนี้)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Footer */}
        <footer className="text-center py-4 text-xs font-semibold text-slate-500">
          ระบบลงเวลาปฏิบัติงานออนไลน์ {config.orgName} โดย รองฯภัทรธีระ ประทุมเม
        </footer>

        {/* Floating Action Button (Bottom Right) for Admin PIN Login */}
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            type="button"
            onClick={() => setAdminPinModalOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center shadow-xl shadow-purple-900/30 hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white/80"
            title="เข้าระบบผู้ดูแลระบบ (Admin PIN 6 หลัก)"
          >
            <ShieldCheck className="w-7 h-7" />
          </button>
          <div className="absolute right-16 top-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            เข้าระบบผู้ดูแลระบบ (Admin PIN)
          </div>
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
        onOpenFaceScanner={(action) => handleDirectClock(action)}
        onOpenLeaveModal={handleLeaveRequest}
        onOpenOfficialModal={handleOfficialDutyRequest}
        onOpenConfigModal={() => setConfigModalOpen(true)}
        onOpenUsersModal={() => setUsersModalOpen(true)}
        onOpenEditProfile={() => setEditProfileModalOpen(true)}
      />

      {/* Main Layout */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-purple-100 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-purple-50 lg:hidden cursor-pointer"
              title="เปิดเมนู"
            >
              <Menu className="w-6 h-6 text-[#7C3AED]" />
            </button>

            <div className="flex items-center gap-3">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 rounded-xl object-cover shadow-sm border border-purple-200 hidden sm:block"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white flex items-center justify-center hidden sm:flex shadow-sm">
                  <School className="w-5 h-5" />
                </div>
              )}
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">
                  {config.orgName}
                </h2>
                <p className="text-[11px] text-purple-700 font-medium hidden sm:block">
                  {config.orgAffiliation}
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Pill in Header */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setEditProfileModalOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-purple-50 hover:bg-purple-100/70 border border-purple-200 transition-all cursor-pointer group"
            >
              <img
                src={
                  currentUser.img ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    currentUser.fullname
                  )}&background=8B5CF6&color=fff`
                }
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover border border-white"
              />
              <span className="text-xs font-bold text-slate-700 group-hover:text-[#7C3AED]">
                {currentUser.fullname.split(' ')[0]}
              </span>
              <span className="text-[10px] bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full font-bold">
                {currentUser.role === 'admin' ? 'Admin' : 'ครู'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Admin Navigation Ribbon */}
        {currentUser.role === 'admin' && (
          <div className="bg-white border-b border-purple-100 px-4 sm:px-8 py-2.5 overflow-x-auto flex items-center gap-2 shadow-xs z-20">
            <button
              onClick={() => setCurrentTab('admin-dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'admin-dashboard'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>ภาพรวมประจำวัน</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-summary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'admin-summary'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>สรุปรายบุคคล (เดือน)</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-map')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'admin-map'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>แผนที่ดาวเทียม</span>
            </button>

            <button
              onClick={() => setUsersModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#8B5CF6]" />
              <span>จัดการสมาชิก/ครู</span>
            </button>

            <button
              onClick={() => setConfigModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[#8B5CF6]" />
              <span>ตั้งค่าระบบ/ขอบเขต</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin-logs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'admin-logs'
                  ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-900/15'
                  : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
              }`}
            >
              <FileClock className="w-4 h-4" />
              <span>ประวัติระบบ (Logs)</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {/* TEACHER HOME VIEW (Attendance Clocking Dashboard) */}
          {currentUser.role !== 'admin' && currentTab === 'home' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Clock & Teacher Profile Card */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-purple-950/5 border border-purple-100">
                  {/* Digital Clock Banner */}
                  <div className="bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#8B5CF6] p-8 text-white text-center relative overflow-hidden">
                    <div className="text-[11px] font-bold tracking-widest uppercase bg-white/20 text-purple-100 px-3 py-1 rounded-full border border-white/20 inline-block mb-3">
                      เวลาประเทศไทย (GMT+7)
                    </div>
                    <div className="flex items-baseline justify-center font-mono font-extrabold text-5xl sm:text-6xl tracking-tight drop-shadow-md">
                      <span>{timeString.hourMin}</span>
                      <span className="text-2xl sm:text-3xl opacity-80 ml-1">:{timeString.sec}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-purple-100 font-semibold mt-2 opacity-95">
                      {thaiDateString}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="p-6 text-center -mt-8 relative z-10">
                    <div className="relative inline-block mb-3">
                      <img
                        src={
                          currentUser.img ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            currentUser.fullname
                          )}&background=8B5CF6&color=fff`
                        }
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg mx-auto bg-white"
                      />
                      <button
                        onClick={() => setEditProfileModalOpen(true)}
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#7C3AED] text-white shadow-md hover:bg-[#6D28D9] cursor-pointer"
                        title="แก้ไขข้อมูลส่วนตัว"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-800">{currentUser.fullname}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {currentUser.position || 'ครูผู้สอน'} • {currentUser.department || 'ฝ่ายวิชาการ'}
                    </p>

                    {/* Bound Device Bluetooth MAC Info */}
                    <div className="mt-5 p-3 rounded-2xl bg-purple-50/80 border border-purple-200/80 text-left text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bluetooth className="w-4 h-4 text-[#7C3AED] shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Bluetooth MAC ที่ผูกไว้
                          </div>
                          <div className="font-mono font-bold text-purple-900 text-xs">
                            {currentUser.registeredMac || currentDeviceMac}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        {deviceLabel}
                      </span>
                    </div>

                    {/* School Center Location & Radius Badge */}
                    <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            จุดลงเวลาโรงเรียน
                          </div>
                          <div className="font-semibold text-slate-700 text-xs truncate max-w-[190px]">
                            {config.orgName}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                        รัศมี {config.radius} ม.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: GPS Accuracy Status Indicator + 4 Action Cards + Recent History */}
              <div className="lg:col-span-7 space-y-6">
                {/* ========================================================================= */}
                {/* 1. ตัวแสดงสถานะความแม่นยำของพิกัด GPS บนหน้าลงเวลา                           */}
                {/* เปลี่ยนสีไอคอน MapPin ตามความแม่นยำ (สีเขียวเมื่อคลาดเคลื่อนต่ำกว่า 50 เมตร)     */}
                {/* ========================================================================= */}
                <div className="bg-white p-5 sm:p-6 rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* MapPin with dynamic accuracy-based color */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-xs ${
                          gpsAccuracy === null
                            ? 'bg-slate-100 text-slate-400'
                            : gpsAccuracy < 50
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : gpsAccuracy <= 100
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        <MapPin
                          className={`w-6 h-6 transition-all ${
                            gpsAccuracy === null
                              ? 'text-slate-400 animate-pulse'
                              : gpsAccuracy < 50
                              ? 'text-emerald-500 scale-110 drop-shadow-sm'
                              : gpsAccuracy <= 100
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">
                            สถานะสัญญาณดาวเทียม GPS
                          </h4>
                          {/* Accuracy Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                              gpsAccuracy === null
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : gpsAccuracy < 50
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : gpsAccuracy <= 100
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {gpsAccuracy === null
                              ? 'กำลังค้นหาสัญญาณ...'
                              : gpsAccuracy < 50
                              ? `✓ แม่นยำสูง (คลาดเคลื่อน ±${gpsAccuracy} ม.)`
                              : gpsAccuracy <= 100
                              ? `แม่นยำปานกลาง (คลาดเคลื่อน ±${gpsAccuracy} ม.)`
                              : `คลาดเคลื่อนสูง (±${gpsAccuracy} ม.)`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {gpsCoords
                            ? `พิกัดปัจจุบัน: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`
                            : 'กำลังเชื่อมต่อดาวเทียม GPS...'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={refreshGpsLocation}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border border-purple-200/70 shrink-0"
                      title="รีเฟรชพิกัด GPS ใหม่"
                    >
                      <RefreshCw className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">รีเฟรชพิกัด</span>
                    </button>
                  </div>

                  {/* Distance & School Zone Check */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <span>ระยะห่างจากจุดโรงเรียน:</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {gpsDistance !== null ? `${gpsDistance} เมตร` : '-'}
                      </span>
                      <span className="text-slate-400">(รัศมีที่อนุญาต {config.radius} เมตร)</span>
                    </div>

                    <div>
                      {gpsDistance !== null && (
                        gpsDistance <= (config.radius || 150) ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs inline-flex items-center gap-1.5 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> อยู่ในรัศมีโรงเรียน พร้อมลงเวลา
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-xs inline-flex items-center gap-1.5 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> อยู่นอกพื้นที่โรงเรียน ({gpsDistance} ม.)
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* 4 Action Cards Grid (Direct Clock In/Out without Face Scanner) */}
                <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-[#7C3AED]" /> บันทึกเวลาปฏิบัติงานวันนี้
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">{thaiDateString}</span>
                  </div>

                  {/* 1. Check-In Button (Bluetooth MAC + GPS) */}
                  <div
                    onClick={() => handleDirectClock('IN')}
                    className={`p-5 rounded-2xl text-white flex items-center justify-between shadow-lg transition-all cursor-pointer group ${
                      todaySummary.leave || todaySummary.official
                        ? 'bg-slate-300 opacity-60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 shadow-emerald-700/20 hover:scale-[1.01] hover:brightness-105'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">ลงเวลามาปฏิบัติงาน (IN)</h4>
                        <p className="text-xs text-emerald-100 font-medium">
                          Bluetooth MAC + พิกัดดาวเทียม GPS
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {todaySummary.leave || todaySummary.official ? (
                        <span className="text-[11px] font-bold bg-black/20 text-white px-2.5 py-1 rounded-xl">
                          ล็อก (แจ้งลาแล้ว)
                        </span>
                      ) : (
                        <div
                          className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-sm shadow-sm ${
                            todaySummary.in !== '--:--'
                              ? 'bg-white text-emerald-700'
                              : 'bg-white/20 text-white border border-white/30'
                          }`}
                        >
                          {todaySummary.in}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Check-Out Button (Bluetooth MAC + GPS) */}
                  <div
                    onClick={() => handleDirectClock('OUT')}
                    className={`p-5 rounded-2xl text-white flex items-center justify-between shadow-lg transition-all cursor-pointer group ${
                      todaySummary.leave || todaySummary.official
                        ? 'bg-slate-300 opacity-60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 shadow-amber-700/20 hover:scale-[1.01] hover:brightness-105'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <LogOut className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">ลงเวลากลับ (OUT)</h4>
                        <p className="text-xs text-amber-100 font-medium">บันทึกเวลาสิ้นสุดงาน</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {todaySummary.leave || todaySummary.official ? (
                        <span className="text-[11px] font-bold bg-black/20 text-white px-2.5 py-1 rounded-xl">
                          ล็อก (แจ้งลาแล้ว)
                        </span>
                      ) : (
                        <div
                          className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-sm shadow-sm ${
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

                  {/* 3. Leave Request Button (Locked if Clocked-in today!) */}
                  <div
                    onClick={handleLeaveRequest}
                    className={`p-5 rounded-2xl text-white flex items-center justify-between shadow-lg transition-all cursor-pointer group ${
                      todaySummary.in !== '--:--' || todaySummary.out !== '--:--'
                        ? 'bg-slate-400/80 cursor-not-allowed'
                        : 'bg-gradient-to-r from-sky-500 via-blue-600 to-sky-600 shadow-blue-700/20 hover:scale-[1.01] hover:brightness-105'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <CalendarOff className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">แจ้งลาหยุด (LEAVE)</h4>
                        <p className="text-xs text-sky-100 font-medium">
                          {todaySummary.in !== '--:--'
                            ? 'ล็อก: วันนี้ลงเวลาแล้ว ไม่สามารถลาได้'
                            : 'ลาป่วย / ลากิจ / ลาพักผ่อน'}
                        </p>
                      </div>
                    </div>
                    <div>
                      {todaySummary.in !== '--:--' ? (
                        <span className="px-2.5 py-1 rounded-xl bg-black/25 text-white text-[11px] font-bold">
                          ล็อกแล้ว
                        </span>
                      ) : (
                        <div
                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm ${
                            todaySummary.leave
                              ? 'bg-white text-sky-700'
                              : 'bg-white/20 text-white border border-white/30'
                          }`}
                        >
                          {todaySummary.leave ? todaySummary.leave.split(' ')[0] : 'แจ้งลา'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Official Duty Button (Locked if Clocked-in today!) */}
                  <div
                    onClick={handleOfficialDutyRequest}
                    className={`p-5 rounded-2xl text-white flex items-center justify-between shadow-lg transition-all cursor-pointer group ${
                      todaySummary.in !== '--:--' || todaySummary.out !== '--:--'
                        ? 'bg-slate-400/80 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 via-violet-700 to-purple-600 shadow-purple-700/20 hover:scale-[1.01] hover:brightness-105'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">ไปราชการ (OFFICIAL)</h4>
                        <p className="text-xs text-purple-100 font-medium">
                          {todaySummary.in !== '--:--'
                            ? 'ล็อก: วันนี้ลงเวลาแล้ว ไม่สามารถไปราชการได้'
                            : 'ปฏิบัติงานนอกสถานที่ / อบรม'}
                        </p>
                      </div>
                    </div>
                    <div>
                      {todaySummary.in !== '--:--' ? (
                        <span className="px-2.5 py-1 rounded-xl bg-black/25 text-white text-[11px] font-bold">
                          ล็อกแล้ว
                        </span>
                      ) : (
                        <div
                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm ${
                            todaySummary.official
                              ? 'bg-white text-purple-800'
                              : 'bg-white/20 text-white border border-white/30'
                          }`}
                        >
                          {todaySummary.official ? 'บันทึกแล้ว' : 'บันทึก'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent History Table */}
                <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#7C3AED]" /> ประวัติการลงเวลาย้อนหลัง
                    </h3>
                    <button
                      onClick={() => fetchUserAttendance(currentUser.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#7C3AED] transition-colors cursor-pointer"
                      title="รีเฟรชข้อมูล"
                    >
                      <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {historyLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                      <p className="text-xs">กำลังโหลดประวัติ...</p>
                    </div>
                  ) : userHistory.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">ยังไม่มีรายการลงเวลาในระบบ</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:bg-purple-50/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-bold text-xs ${
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
                            <div>
                              <div className="font-bold text-xs text-slate-800">
                                {item.action === 'IN'
                                  ? 'ลงเวลาเข้างาน'
                                  : item.action === 'OUT'
                                  ? 'ลงเวลากลับ'
                                  : item.action === 'LEAVE'
                                  ? 'แจ้งลาหยุด'
                                  : 'ไปราชการ'}
                                {item.note && <span className="text-slate-500 font-normal ml-1">({item.note})</span>}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {item.dateThai || item.date}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-slate-800">{item.time} น.</div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
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

          {/* ADMIN MANAGEMENT DASHBOARD */}
          {currentUser.role === 'admin' && (
            <AdminReports
              config={config}
              activeView={currentTab.startsWith('admin-') ? currentTab.replace('admin-', '') as any : 'dashboard'}
              selectedDate={selectedAdminDate}
              onDateChange={setSelectedAdminDate}
              selectedMonth={selectedAdminMonth}
              onMonthChange={setSelectedAdminMonth}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="text-center py-6 text-xs font-semibold text-slate-400 border-t border-purple-100 bg-white/60">
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
    </div>
  );
}
