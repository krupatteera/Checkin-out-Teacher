import React, { useState, useEffect } from 'react';
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
  FileClock
} from 'lucide-react';
import { SchoolConfig, UserAccount, AttendanceRecord } from './types';
import {
  getSchoolConfig,
  findUserByUsername,
  registerNewUser,
  getUserStatusToday,
  getUserRecentHistory,
  saveAttendanceRecord,
  DEFAULT_CONFIG
} from './firebase';
import { getOrGenerateDeviceMac, getDeviceInfoLabel, verifyDeviceMac } from './utils/deviceMac';
import { Swal } from './utils/sweetAlert';
import { FaceScannerModal } from './components/FaceScannerModal';
import { RegisterModal } from './components/RegisterModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AdminConfigModal } from './components/AdminConfigModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { AdminReports } from './components/AdminReports';
import { Navigation } from './components/Navigation';
import { AttendanceSkeleton } from './components/SkeletonLoader';

export default function App() {
  // Global System State
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_CONFIG);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Active view tab
  const [currentTab, setCurrentTab] = useState<'home' | 'admin-dashboard' | 'admin-summary' | 'admin-map' | 'admin-logs'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Attendance user data (Teachers only)
  const [todaySummary, setTodaySummary] = useState({ in: '--:--', out: '--:--', leave: '', official: '' });
  const [userHistory, setUserHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Current real-time clock
  const [timeString, setTimeString] = useState({ hourMin: '00:00', sec: '00' });
  const [thaiDateString, setThaiDateString] = useState('');

  // Modals state
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceActionType, setFaceActionType] = useState<'IN' | 'OUT'>('IN');
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);

  // Admin filter dates
  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedAdminDate, setSelectedAdminDate] = useState(todayIso);
  const currentMonthIso = todayIso.substring(0, 7);
  const [selectedAdminMonth, setSelectedAdminMonth] = useState(currentMonthIso);

  // Device MAC Address
  const currentDeviceMac = getOrGenerateDeviceMac();
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
            password: '111',
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

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const u = loginUsername.trim();
    const p = loginPassword.trim();

    if (!u || !p) {
      Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอก Username และ Password', 'warning');
      return;
    }

    setLoginLoading(true);

    try {
      const userDoc = await findUserByUsername(u);

      setLoginLoading(false);

      if (!userDoc) {
        Swal.fire('เข้าสู่ระบบไม่สำเร็จ', 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ', 'error');
        return;
      }

      if (userDoc.password !== p) {
        Swal.fire('เข้าสู่ระบบไม่สำเร็จ', 'รหัสผ่านไม่ถูกต้อง', 'error');
        return;
      }

      if (userDoc.status === 'PENDING') {
        Swal.fire({
          title: 'รอการอนุมัติจากผู้ดูแลระบบ',
          html: `
            <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                <p class="font-bold flex items-center gap-1.5 text-xs">
                  <span>⏳ สถานะ: รอการอนุมัติ (Pending Approval)</span>
                </p>
                <p class="mt-1 text-[11px] leading-relaxed">
                  บัญชีของ <b>${userDoc.fullname}</b> (@${userDoc.username}) ได้ลงทะเบียนข้อมูลและฐานข้อมูลใบหน้าแล้ว ขณะนี้<b>อยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติการใช้งาน</b>
                </p>
              </div>
              <p class="text-[11px] text-slate-500">
                *กรุณาติดต่อผู้ดูแลระบบเพื่อขอรับการอนุมัติก่อนเข้าสู่ระบบและลงเวลา
              </p>
            </div>
          `,
          icon: 'info',
          confirmButtonColor: '#7C3AED',
          confirmButtonText: 'รับทราบ'
        });
        return;
      }

      if (userDoc.status !== 'ACTIVE') {
        Swal.fire('บัญชีถูกระงับ', 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 'warning');
        return;
      }

      // If user hasn't bound a MAC yet, bind this current device automatically
      if (!userDoc.registeredMac && userDoc.role !== 'admin') {
        userDoc.registeredMac = currentDeviceMac;
      }

      setCurrentUser(userDoc);
      sessionStorage.setItem('attendance_active_user', JSON.stringify(userDoc));

      Swal.fire({
        title: 'ยินดีต้อนรับ',
        text: `เข้าสู่ระบบสำเร็จ: ${userDoc.fullname}`,
        icon: 'success',
        timer: 1500
      });

      if (userDoc.role === 'admin') {
        setCurrentTab('admin-dashboard');
      } else {
        fetchUserAttendance(userDoc.id);
        setCurrentTab('home');
      }
    } catch (err: unknown) {
      setLoginLoading(false);
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // Logout with Sweet Confirm
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
      setLoginPassword('');
      setMobileMenuOpen(false);
      Swal.fire({
        title: 'ออกจากระบบสำเร็จ',
        icon: 'success',
        timer: 1200
      });
    }
  };

  // Open Face Scanner for Clock In / Out (Teachers only)
  const handleTriggerClock = (action: 'IN' | 'OUT') => {
    if (!currentUser || currentUser.role === 'admin') return;

    if (todaySummary.leave) {
      Swal.fire('ไม่สามารถลงเวลาได้', `ระบบพบว่าคุณได้แจ้งลาหยุด (${todaySummary.leave}) ไปแล้วในวันนี้`, 'warning');
      return;
    }
    if (todaySummary.official) {
      Swal.fire('ไม่สามารถลงเวลาได้', `ระบบพบว่าคุณได้บันทึกไปราชการ (${todaySummary.official}) แล้วในวันนี้`, 'warning');
      return;
    }

    if (action === 'IN' && todaySummary.in !== '--:--') {
      Swal.fire('ลงเวลาเข้างานแล้ว', `คุณได้ลงเวลาเข้างานไปแล้วเมื่อ ${todaySummary.in} น.`, 'info');
      return;
    }

    if (action === 'OUT') {
      if (todaySummary.in === '--:--') {
        Swal.fire('ไม่อนุญาตให้ลงเวลากลับ', 'กรุณาสแกน "ลงเวลาเข้างาน" ให้เรียบร้อยก่อนลงเวลากลับ', 'warning');
        return;
      }
      if (todaySummary.out !== '--:--') {
        Swal.fire('ลงเวลากลับแล้ว', `คุณได้ลงเวลากลับไปแล้วเมื่อ ${todaySummary.out} น.`, 'info');
        return;
      }
    }

    setFaceActionType(action);
    setFaceModalOpen(true);
  };

  // Handle successful face scan + GPS capture with AI Face Recognition
  const handleFaceSuccess = async (result: {
    lat: number;
    lng: number;
    distance: number;
    macAddress: string;
    faceSnapshot: string;
    aiVerification?: {
      isMatch: boolean;
      confidenceScore: number;
      analysis: string;
    };
  }) => {
    setFaceModalOpen(false);

    if (!currentUser) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const isLate = Boolean(faceActionType === 'IN' && config.lateTime && timeStr > config.lateTime);
    const isEarly = Boolean(faceActionType === 'OUT' && config.earlyTime && timeStr < config.earlyTime);

    let finalNote = '';
    if (isLate) finalNote = 'เข้าสาย';
    if (isEarly) finalNote = 'กลับก่อนเวลา';

    try {
      await saveAttendanceRecord({
        userId: currentUser.id,
        employeeId: currentUser.username,
        employeeName: currentUser.fullname,
        action: faceActionType,
        date: dateStr,
        dateThai: thaiDateString,
        time: timeStr,
        lat: result.lat,
        lng: result.lng,
        distance: result.distance,
        isLate,
        isEarly,
        note: finalNote,
        macAddress: result.macAddress,
        faceSnapshot: result.faceSnapshot,
        aiVerification: result.aiVerification,
        timestamp: now.getTime()
      });

      const aiMatchBadge = result.aiVerification
        ? `<div class="mt-2.5 p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-left text-xs"><div class="font-bold text-[#7C3AED] flex items-center gap-1">✨ AI Face Match: ${result.aiVerification.confidenceScore}%</div><p class="text-[11px] text-slate-600 mt-0.5">${result.aiVerification.analysis}</p></div>`
        : '';

      await Swal.fire({
        title: faceActionType === 'IN' ? 'ลงเวลาเข้างานสำเร็จ!' : 'ลงเวลากลับสำเร็จ!',
        html: `เวลา: <b>${timeStr} น.</b><br>${isLate ? '<span class="text-rose-600 font-bold">(เข้าสาย)</span><br>' : ''}${isEarly ? '<span class="text-amber-600 font-bold">(กลับก่อนเวลา)</span><br>' : ''}<span class="text-xs text-slate-500 font-mono">MAC: ${result.macAddress}</span>${aiMatchBadge}`,
        icon: 'success'
      });

      fetchUserAttendance(currentUser.id);
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // Handle Leave with Custom SweetAlert (Teachers only)
  const handleLeaveRequest = async () => {
    if (!currentUser || currentUser.role === 'admin') return;
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
        employeeId: currentUser.username,
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

  // Handle Official Duty (Teachers only)
  const handleOfficialDutyRequest = async () => {
    if (!currentUser || currentUser.role === 'admin') return;
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
        employeeId: currentUser.username,
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
  // RENDER: LOGIN PAGE (HORIZONTAL CARD)
  // --------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-purple-50/40 to-slate-100 p-4 sm:p-6 lg:p-10">
        <div className="flex-1 flex items-center justify-center py-6">
          {/* Horizontal Card for Login */}
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-purple-950/10 border border-purple-100 overflow-hidden grid grid-cols-1 md:grid-cols-12 transition-all">
            {/* Left Column: School Information & Pastel Purple Branding */}
            <div className="md:col-span-5 bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#8B5CF6] p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
              {/* Decorative background glow */}
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
                    <span>สแกนใบหน้าตรวจสอบตัวตนผ่านมือถือ</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <MapPin className="w-5 h-5 text-[#AED581] shrink-0" />
                    <span>บังคับพิกัด GPS ให้อยู่ในรัศมี {config.radius} เมตร</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                    <ShieldCheck className="w-5 h-5 text-[#FFCA28] shrink-0" />
                    <span>จดจำ MAC Address ป้องกันการลงเวลาแทนกัน</span>
                  </div>
                </div>
              </div>

              {/* Hardware Device Signature Info */}
              <div className="relative z-10 mt-8 pt-4 border-t border-white/15 text-[11px] text-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#C4B5FD]" />
                  <span className="font-mono">{currentDeviceMac}</span>
                </div>
                <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full">{deviceLabel}</span>
              </div>
            </div>

            {/* Right Column: Unified Login Form (Teacher & Admin) */}
            <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-[#7C3AED] text-xs font-bold mb-2 border border-purple-200">
                  <Lock className="w-3.5 h-3.5" /> เข้าสู่ระบบแบบรวมบทบาท
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800">เข้าสู่ระบบ</h2>
                <p className="text-xs text-slate-500 mt-1">
                  สำหรับครูและผู้ดูแลระบบ (ระบบตรวจสอบสิทธิ์จาก Username อัตโนมัติ)
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสผู้ใช้งาน (Username)
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="เช่น kru.somchai หรือ admin"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/60 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/60 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-extrabold text-sm shadow-lg shadow-purple-800/25 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> กำลังตรวจสอบข้อมูล...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" /> ล็อกอินเข้าสู่ระบบ
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Register link with MAC binding mention */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                <span className="text-slate-500">ยังไม่มีบัญชีผู้ใช้งานหรือเครื่องใหม่?</span>
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

        {/* Footer as requested */}
        <footer className="text-center py-4 text-xs font-semibold text-slate-500">
          ระบบลงเวลาปฏิบัติงานออนไลน์ {config.orgName} โดย รองฯภัทรธีระ ประทุมเม
        </footer>

        {/* Register Modal */}
        <RegisterModal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          onSuccess={() => {}}
        />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: AUTHENTICATED DASHBOARD (TEACHER & ADMIN)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80">
      {/* Navigation (Sidebar Desktop + Off-Canvas Mobile + Floating Bottom Nav) */}
      <Navigation
        user={currentUser}
        config={config}
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        onLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenFaceScanner={(action) => handleTriggerClock(action)}
        onOpenLeaveModal={handleLeaveRequest}
        onOpenOfficialModal={handleOfficialDutyRequest}
        onOpenConfigModal={() => setConfigModalOpen(true)}
        onOpenUsersModal={() => setUsersModalOpen(true)}
        onOpenEditProfile={() => setEditProfileModalOpen(true)}
      />

      {/* Main Layout (Margin for Sidebar on LG screens) */}
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

        {/* Admin Navigation Ribbon (แถบเมนูลัดเฉพาะผู้ดูแลระบบ - ไม่มีการลงเวลาปฏิบัติงาน) */}
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
          {/* TEACHER HOME VIEW (Attendance Clocking Dashboard - For Teachers Only!) */}
          {currentUser.role !== 'admin' && currentTab === 'home' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Clock & Teacher Profile Card */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-purple-950/5 border border-purple-100">
                  {/* Digital Clock Banner with Pastel Purple Gradient */}
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

                  {/* Profile info & Device MAC */}
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

                    {/* Bound Device MAC Info */}
                    <div className="mt-5 p-3 rounded-2xl bg-purple-50/80 border border-purple-200/80 text-left text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#7C3AED] shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            MAC Address ที่ผูกไว้
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

              {/* Right Column: 4 Action Cards & Attendance History */}
              <div className="lg:col-span-7 space-y-6">
                {/* 4 Action Cards Grid */}
                <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-purple-950/5 border border-purple-100 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-[#7C3AED]" /> บันทึกเวลาปฏิบัติงานวันนี้
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">{thaiDateString}</span>
                  </div>

                  {/* 1. Check-In Button */}
                  <div
                    onClick={() => handleTriggerClock('IN')}
                    className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white flex items-center justify-between shadow-lg shadow-emerald-700/20 hover:scale-[1.01] hover:brightness-105 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">ลงเวลามาปฏิบัติงาน (IN)</h4>
                        <p className="text-xs text-emerald-100 font-medium">สแกนใบหน้า + พิกัดดาวเทียม</p>
                      </div>
                    </div>
                    <div
                      className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-sm shadow-sm ${
                        todaySummary.in !== '--:--'
                          ? 'bg-white text-emerald-700'
                          : 'bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {todaySummary.in}
                    </div>
                  </div>

                  {/* 2. Check-Out Button */}
                  <div
                    onClick={() => handleTriggerClock('OUT')}
                    className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white flex items-center justify-between shadow-lg shadow-amber-700/20 hover:scale-[1.01] hover:brightness-105 transition-all cursor-pointer group"
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
                    <div
                      className={`px-3.5 py-1.5 rounded-xl font-bold font-mono text-sm shadow-sm ${
                        todaySummary.out !== '--:--'
                          ? 'bg-white text-amber-800'
                          : 'bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {todaySummary.out}
                    </div>
                  </div>

                  {/* 3. Leave Request Button */}
                  <div
                    onClick={handleLeaveRequest}
                    className="p-5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-sky-600 text-white flex items-center justify-between shadow-lg shadow-blue-700/20 hover:scale-[1.01] hover:brightness-105 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <CalendarOff className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">แจ้งลาหยุด (LEAVE)</h4>
                        <p className="text-xs text-sky-100 font-medium">ลาป่วย / ลากิจ / ลาพักผ่อน</p>
                      </div>
                    </div>
                    <div
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm ${
                        todaySummary.leave
                          ? 'bg-white text-sky-700'
                          : 'bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {todaySummary.leave ? todaySummary.leave.split(' ')[0] : 'แจ้งลา'}
                    </div>
                  </div>

                  {/* 4. Official Duty Button */}
                  <div
                    onClick={handleOfficialDutyRequest}
                    className="p-5 rounded-2xl bg-gradient-to-r from-purple-500 via-violet-700 to-purple-600 text-white flex items-center justify-between shadow-lg shadow-purple-700/20 hover:scale-[1.01] hover:brightness-105 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold">ไปราชการ (OFFICIAL)</h4>
                        <p className="text-xs text-purple-100 font-medium">ปฏิบัติงานนอกสถานที่ / อบรม</p>
                      </div>
                    </div>
                    <div
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm ${
                        todaySummary.official
                          ? 'bg-white text-purple-800'
                          : 'bg-white/20 text-white border border-white/30'
                      }`}
                    >
                      {todaySummary.official ? 'บันทึกแล้ว' : 'บันทึก'}
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

          {/* ADMIN MANAGEMENT DASHBOARD (ผู้ดูแลระบบเท่านั้น - ไม่มีการลงเวลาปฏิบัติงาน) */}
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
      {/* 1. Biometric Face Scanner Modal (Teachers only) */}
      <FaceScannerModal
        actionType={faceActionType}
        user={currentUser}
        config={config}
        isOpen={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        onSuccess={handleFaceSuccess}
      />

      {/* 2. Edit Profile Modal */}
      <EditProfileModal
        user={currentUser}
        isOpen={editProfileModalOpen}
        onClose={() => setEditProfileModalOpen(false)}
        onSuccess={(updated) => {
          setCurrentUser(updated);
          sessionStorage.setItem('attendance_active_user', JSON.stringify(updated));
        }}
      />

      {/* 3. Admin Config Modal */}
      <AdminConfigModal
        config={config}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSuccess={(newCfg) => setConfig(newCfg)}
      />

      {/* 4. Admin Users Modal */}
      <AdminUsersModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        onOpenRegister={() => setRegisterModalOpen(true)}
        currentAdminUsername={currentUser?.username || 'admin'}
      />

      {/* 5. Register Modal */}
      <RegisterModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
