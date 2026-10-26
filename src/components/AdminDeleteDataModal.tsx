import React, { useState, useEffect } from 'react';
import {
  Trash2,
  X,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  FileClock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Users,
  RefreshCw,
  Search
} from 'lucide-react';
import { SchoolConfig, UserAccount } from '../types';
import {
  getAllUsersList,
  deleteAttendanceByUser,
  deleteAttendanceByUserAndDate,
  deleteAttendanceByDate,
  deleteAllAttendance,
  deleteLogsByMonth,
  deleteAllLogs,
  getAttendanceByDateRange,
  getAttendanceByDate,
  getSystemLogsList
} from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { getBangkokParts, getInternetIsoDate } from '../utils/internetTime';
import { formatThaiDateText } from './TeacherReport';

interface AdminDeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUsername: string;
  config: SchoolConfig;
  onDataDeleted?: () => void;
}

export const THAI_MONTHS_SELECT = [
  { value: '01', name: 'มกราคม' },
  { value: '02', name: 'กุมภาพันธ์' },
  { value: '03', name: 'มีนาคม' },
  { value: '04', name: 'เมษายน' },
  { value: '05', name: 'พฤษภาคม' },
  { value: '06', name: 'มิถุนายน' },
  { value: '07', name: 'กรกฎาคม' },
  { value: '08', name: 'สิงหาคม' },
  { value: '09', name: 'กันยายน' },
  { value: '10', name: 'ตุลาคม' },
  { value: '11', name: 'พฤศจิกายน' },
  { value: '12', name: 'ธันวาคม' }
];

export const AdminDeleteDataModal: React.FC<AdminDeleteDataModalProps> = ({
  isOpen,
  onClose,
  adminUsername,
  config,
  onDataDeleted
}) => {
  const [activeCategory, setActiveCategory] = useState<'attendance' | 'logs'>('attendance');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Users data
  const [teachers, setTeachers] = useState<UserAccount[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [teacherSearch, setTeacherSearch] = useState<string>('');

  // Counts state
  const [totalAttendanceCount, setTotalAttendanceCount] = useState<number>(0);
  const [teacherAttendanceCount, setTeacherAttendanceCount] = useState<number>(0);
  const [teacherDateAttendanceCount, setTeacherDateAttendanceCount] = useState<number>(0);
  const [dateAttendanceCount, setDateAttendanceCount] = useState<number>(0);
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);
  const [monthLogsCount, setMonthLogsCount] = useState<number>(0);

  // Date selection for attendance deletion
  const [selectedDate, setSelectedDate] = useState<string>(() => getInternetIsoDate());
  const [teacherDeleteMode, setTeacherDeleteMode] = useState<'all' | 'specific'>('specific');
  const [selectedTeacherDate, setSelectedTeacherDate] = useState<string>(() => getInternetIsoDate());

  // Month selection for logs
  const bkk = getBangkokParts();
  const currentCE = bkk.year;
  const currentMonthNum = String(bkk.month).padStart(2, '0');
  const [logMonthNum, setLogMonthNum] = useState<string>(currentMonthNum);
  const [logYearBE, setLogYearBE] = useState<number>(currentCE + 543);

  // Security confirmation input for delete-all
  const [confirmText, setConfirmText] = useState<string>('');

  const checkDateCount = async (dateStr: string) => {
    if (!dateStr) {
      setDateAttendanceCount(0);
      return;
    }
    try {
      const recs = await getAttendanceByDate(dateStr);
      setDateAttendanceCount(recs.length);
    } catch (err) {
      console.error('Error checking date attendance count:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load users
      const allUsers = await getAllUsersList();
      const teacherUsers = allUsers.filter((u) => u.role !== 'admin');
      setTeachers(teacherUsers);

      if (teacherUsers.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(teacherUsers[0].id);
      }

      // 2. Query total attendance count
      const allAtt = await getAttendanceByDateRange('2000-01-01', '2100-12-31');
      setTotalAttendanceCount(allAtt.length);

      // 3. Query total logs count
      const allLogs = await getSystemLogsList();
      setTotalLogsCount(allLogs.length);

      // 4. Query date attendance count
      await checkDateCount(selectedDate);
    } catch (err) {
      console.error('Error loading data for delete modal:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate date-specific attendance count
  useEffect(() => {
    checkDateCount(selectedDate);
  }, [selectedDate]);

  // Recalculate teacher-specific attendance count & date count
  useEffect(() => {
    if (!selectedTeacherId) {
      setTeacherAttendanceCount(0);
      setTeacherDateAttendanceCount(0);
      return;
    }
    const checkTeacherCount = async () => {
      try {
        const allAtt = await getAttendanceByDateRange('2000-01-01', '2100-12-31');
        const teacherRecs = allAtt.filter(
          (r) => r.userId === selectedTeacherId || r.employeeId === selectedTeacherId
        );
        setTeacherAttendanceCount(teacherRecs.length);

        const dateRecs = teacherRecs.filter((r) => r.date === selectedTeacherDate);
        setTeacherDateAttendanceCount(dateRecs.length);
      } catch (err) {
        console.error(err);
      }
    };
    checkTeacherCount();
  }, [selectedTeacherId, selectedTeacherDate]);

  // Recalculate month-specific logs count
  useEffect(() => {
    const checkMonthLogsCount = async () => {
      try {
        const yearCE = logYearBE - 543;
        const startMs = new Date(yearCE, parseInt(logMonthNum, 10) - 1, 1).getTime();
        const endMs = new Date(yearCE, parseInt(logMonthNum, 10), 0, 23, 59, 59, 999).getTime();
        const allLogs = await getSystemLogsList();
        const count = allLogs.filter((l) => l.timestamp >= startMs && l.timestamp <= endMs).length;
        setMonthLogsCount(count);
      } catch (err) {
        console.error(err);
      }
    };
    checkMonthLogsCount();
  }, [logMonthNum, logYearBE]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setConfirmText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const logMonthName = THAI_MONTHS_SELECT.find((m) => m.value === logMonthNum)?.name || 'ตุลาคม';
  const logMonthDisplay = `เดือน ${logMonthName} พ.ศ. ${logYearBE}`;

  // 1. Handler: ลบข้อมูลการลงเวลา "รายบุคคล" (รองรับเลือกลบทั้งหมด หรือเฉพาะวันที่)
  const handleDeleteTeacherAttendance = async () => {
    if (!selectedTeacher) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกคุณครูที่ต้องการลบข้อมูล', 'warning');
      return;
    }

    const isSpecific = teacherDeleteMode === 'specific';
    const targetDate = isSpecific ? selectedTeacherDate : null;
    const targetCount = isSpecific ? teacherDateAttendanceCount : teacherAttendanceCount;

    if (isSpecific && !selectedTeacherDate) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกวันที่ต้องการลบข้อมูล', 'warning');
      return;
    }

    if (targetCount === 0) {
      Swal.fire('แจ้งเตือน', `ไม่พบข้อมูลการลงเวลาของ ${selectedTeacher.fullname}${isSpecific ? ` ในวันที่ ${formatThaiDateText(selectedTeacherDate)}` : ''}`, 'warning');
      return;
    }

    const dateTextHtml = isSpecific 
      ? `<p><b>วันที่ระบุ:</b> ${formatThaiDateText(selectedTeacherDate)} (${selectedTeacherDate})</p>`
      : `<p><b>ช่วงเวลา:</b> ทุกวันที่บันทึก (ทั้งหมด)</p>`;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันลบข้อมูลการลงเวลา?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p class="font-bold text-rose-600 text-sm">คุณกำลังจะลบข้อมูลการลงเวลาของ:</p>
          <div class="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-1">
            <p><b>ชื่อ-นามสกุล:</b> ${selectedTeacher.fullname}</p>
            <p><b>ตำแหน่ง:</b> ${selectedTeacher.position || 'ครูผู้สอน'}</p>
            ${dateTextHtml}
            <p><b>จำนวนข้อมูลที่จะถูกลบ:</b> <span class="text-rose-600 font-bold">${targetCount} รายการ</span></p>
          </div>
          <p class="text-rose-500 font-semibold">* เมื่อยืนยันแล้ว ข้อมูลจะถูกลบออกจากฐานข้อมูลอย่างถาวรและไม่สามารถกู้คืนได้</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบข้อมูลในฐานข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280'
    });

    if (!confirmRes.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await deleteAttendanceByUserAndDate(
        selectedTeacher.id,
        selectedTeacher.fullname,
        targetDate,
        adminUsername
      );
      await loadData();
      onDataDeleted?.();
      Swal.fire('สำเร็จ', res.message, 'success');
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Handler: ลบข้อมูลการลงเวลา "เฉพาะวันที่"
  const handleDeleteDateAttendance = async () => {
    if (!selectedDate) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกวันที่ต้องการลบข้อมูล', 'warning');
      return;
    }

    const thaiDate = formatThaiDateText(selectedDate);

    const confirmRes = await Swal.fire({
      title: 'ยืนยันลบข้อมูลการลงเวลาเฉพาะวันที่?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p class="font-bold text-rose-600 text-sm">คุณกำลังจะลบข้อมูลการลงเวลาประจำวันที่:</p>
          <div class="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-1">
            <p><b>วันที่:</b> ${thaiDate} (${selectedDate})</p>
            <p><b>จำนวนข้อมูลการลงเวลาที่จะถูกลบ:</b> <span class="text-rose-600 font-bold">${dateAttendanceCount} รายการ</span></p>
            <p class="text-slate-500 text-[11px]">ข้อมูลการลงเวลาเข้างาน, เลิกงาน, ลาหยุด และไปราชการของครูทุกคนในวันที่เลือกจะถูกลบออกจากฐานข้อมูล</p>
          </div>
          <p class="text-rose-500 font-semibold">* เมื่อยืนยันแล้ว ข้อมูลจะถูกลบออกจากฐานข้อมูล Firebase อย่างถาวร</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบข้อมูลวันที่นี้',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280'
    });

    if (!confirmRes.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await deleteAttendanceByDate(selectedDate, thaiDate, adminUsername);
      await loadData();
      await checkDateCount(selectedDate);
      onDataDeleted?.();
      Swal.fire('สำเร็จ', res.message, 'success');
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Handler: ลบข้อมูลการลงเวลา "ทั้งหมด"
  const handleDeleteAllAttendance = async () => {
    if (confirmText.trim() !== 'DELETE' && confirmText.trim() !== (config.adminPin || '000000')) {
      Swal.fire({
        title: 'รหัสยืนยันไม่ถูกต้อง',
        text: `กรุณากรอกคำว่า "DELETE" หรือรหัส PIN ผู้ดูแลระบบ (${config.adminPin || '000000'}) เพื่อยืนยัน`,
        icon: 'warning'
      });
      return;
    }

    const confirmRes = await Swal.fire({
      title: 'คำเตือนขั้นสูงสุด!',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p class="font-bold text-rose-600 text-sm">คุณกำลังจะลบข้อมูลการลงเวลา "ทั้งหมดในระบบ" !</p>
          <p>จำนวนข้อมูลทั้งหมด: <b class="text-rose-600 text-base">${totalAttendanceCount}</b> รายการ</p>
          <p class="text-slate-600">ข้อมูลการลงเวลาเข้างาน, เลิกงาน, ลาหยุด และไปราชการของครูทุกคนจะถูกลบเกลี้ยงออกจากฐานข้อมูล Firebase ทันที</p>
          <p class="text-rose-600 font-bold">* การดำเนินการนี้ไม่สามารถย้อนกลับหรือกู้คืนได้เด็ดขาด</p>
        </div>
      `,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'ลบข้อมูลทั้งหมดออกจากฐานข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280'
    });

    if (!confirmRes.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await deleteAllAttendance(adminUsername);
      setConfirmText('');
      await loadData();
      onDataDeleted?.();
      Swal.fire('สำเร็จ', res.message, 'success');
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Handler: ลบประวัติระบบ "รายเดือน"
  const handleDeleteLogsByMonth = async () => {
    const yearCE = logYearBE - 543;
    const yearMonthStr = `${yearCE}-${logMonthNum}`;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันลบประวัติระบบ?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p class="font-bold text-slate-800 text-sm">ลบประวัติการใช้งานระบบประจำ:</p>
          <div class="p-3 rounded-xl bg-slate-100 border border-slate-200">
            <p><b>ช่วงเวลา:</b> ${logMonthDisplay}</p>
            <p><b>จำนวนประวัติที่จะถูกลบ:</b> <span class="text-rose-600 font-bold">${monthLogsCount} รายการ</span></p>
          </div>
          <p class="text-rose-500 font-semibold">* ข้อมูล Logs จะถูกลบออกจากฐานข้อมูลอย่างถาวร</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบประวัติเดือนนี้',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280'
    });

    if (!confirmRes.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await deleteLogsByMonth(yearMonthStr, logMonthDisplay, adminUsername);
      await loadData();
      onDataDeleted?.();
      Swal.fire('สำเร็จ', res.message, 'success');
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Handler: ลบประวัติระบบ "ทั้งหมด"
  const handleDeleteAllLogs = async () => {
    const confirmRes = await Swal.fire({
      title: 'ยืนยันล้างประวัติระบบทั้งหมด?',
      html: `
        <div class="text-left text-xs text-slate-700 space-y-2">
          <p class="font-bold text-rose-600 text-sm">คุณต้องการลบประวัติการทำงาน (System Logs) ทั้งหมดในระบบใช่หรือไม่?</p>
          <p>จำนวนประวัติทั้งหมด: <b class="text-rose-600">${totalLogsCount}</b> รายการ</p>
          <p class="text-slate-500">* ข้อมูลจะถูกลบออกจากฐานข้อมูล Firebase ทันที และระบบจะบันทึก Log ใหม่ว่าผู้ดูแลระบบได้ทำการล้างประวัติ</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันล้างประวัติทั้งหมด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280'
    });

    if (!confirmRes.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await deleteAllLogs(adminUsername);
      await loadData();
      onDataDeleted?.();
      Swal.fire('สำเร็จ', res.message, 'success');
    } catch (err: unknown) {
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.fullname.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      (t.department && t.department.toLowerCase().includes(teacherSearch.toLowerCase())) ||
      (t.position && t.position.toLowerCase().includes(teacherSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-rose-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                เมนูลบข้อมูลในระบบและฐานข้อมูล
              </h2>
              <p className="text-[11px] sm:text-xs text-rose-100 font-medium">
                ลบข้อมูลการลงเวลา (รายบุคคล/เฉพาะวันที่/ทั้งหมด) &amp; ลบประวัติระบบ (รายเดือน/ทั้งหมด)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs: ข้อมูลการลงเวลา vs ประวัติระบบ */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveCategory('attendance')}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border-t border-x ${
              activeCategory === 'attendance'
                ? 'bg-white border-slate-200 text-rose-700 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>ข้อมูลการลงเวลา ({totalAttendanceCount})</span>
          </button>

          <button
            onClick={() => setActiveCategory('logs')}
            className={`px-4 py-2.5 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border-t border-x ${
              activeCategory === 'logs'
                ? 'bg-white border-slate-200 text-rose-700 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileClock className="w-4 h-4" />
            <span>ประวัติระบบ Logs ({totalLogsCount})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-700 flex-1">
          {/* TAB 1: ข้อมูลการลงเวลา (รายบุคคล / ทั้งหมด) */}
          {activeCategory === 'attendance' && (
            <div className="space-y-6">
              {/* SECTION A: ลบข้อมูลการลงเวลารายบุคคล */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                      ลบข้อมูลการลงเวลา : รายบุคคล
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      เลือกลบข้อมูลบันทึกเวลาของครูท่านใดท่านหนึ่งออกจากฐานข้อมูล
                    </p>
                  </div>
                </div>

                {/* Teacher Search & Selector */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="พิมพ์ค้นหาชื่อครู หรือกลุ่มสาระ..."
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      className="bg-transparent text-xs w-full focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      เลือกคุณครู ({filteredTeachers.length} ท่าน):
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      {filteredTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullname} ({t.position || 'ครูผู้สอน'} - {t.department || 'ไม่ระบุ'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Teacher Preview Card & Date Filter Options */}
                  {selectedTeacher && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                            {selectedTeacher.img ? (
                              <img
                                src={selectedTeacher.img}
                                alt={selectedTeacher.fullname}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-purple-700" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-extrabold text-slate-800">
                              {selectedTeacher.fullname}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {selectedTeacher.position || 'ครูผู้สอน'} • สังกัด: {selectedTeacher.department || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-600">ข้อมูลทั้งหมด</div>
                          <div className="font-mono font-extrabold text-purple-700 text-sm">
                            {teacherAttendanceCount} รายการ
                          </div>
                        </div>
                      </div>

                      {/* Deletion Scope Selector: Specific Date vs All Days */}
                      <div className="pt-2 border-t border-purple-200/60 space-y-2.5">
                        <label className="block text-xs font-bold text-slate-700">
                          เลือกรูปแบบการลบข้อมูลของครูท่านนี้:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTeacherDeleteMode('specific')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              teacherDeleteMode === 'specific'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>ลบเฉพาะวันที่เลือก</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeacherDeleteMode('all')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              teacherDeleteMode === 'all'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบทุกวัน (ทั้งหมด)</span>
                          </button>
                        </div>

                        {teacherDeleteMode === 'specific' && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-600">ระบุวันที่ต้องการลบ:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedTeacherDate(getInternetIsoDate())}
                                className="text-[10px] text-purple-700 hover:underline font-semibold cursor-pointer"
                              >
                                วันนี้
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={selectedTeacherDate}
                                onChange={(e) => setSelectedTeacherDate(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
                              />
                            </div>
                            <div className="text-[11px] text-slate-600 pt-0.5">
                              พบข้อมูลในวันที่ <b className="text-slate-800">{formatThaiDateText(selectedTeacherDate)}</b>: <b className="font-mono text-rose-600">{teacherDateAttendanceCount}</b> รายการ
                            </div>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            {teacherDeleteMode === 'specific' 
                              ? `จะลบเฉพาะข้อมูลในวันที่ ${formatThaiDateText(selectedTeacherDate)}`
                              : 'จะลบข้อมูลการลงเวลาทั้งหมดของครูท่านนี้ทุกวัน'}
                          </span>
                          <button
                            type="button"
                            onClick={handleDeleteTeacherAttendance}
                            disabled={actionLoading || (teacherDeleteMode === 'specific' ? teacherDateAttendanceCount === 0 : teacherAttendanceCount === 0)}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ยืนยันลบข้อมูล</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION B: ลบข้อมูลการลงเวลาเฉพาะวันที่ */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                      ลบข้อมูลการลงเวลา : เฉพาะวันที่
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      เลือกลบข้อมูลบันทึกเวลาของครูทุกคนเฉพาะวันที่ระบุออกจากฐานข้อมูล
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        เลือกวันที่ต้องการลบข้อมูล:
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getInternetIsoDate())}
                      className="self-end sm:self-auto sm:mt-5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200 whitespace-nowrap"
                    >
                      เลือกวันนี้
                    </button>
                  </div>

                  {/* Date Status & Action Card */}
                  <div className="p-3 sm:p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        <span>วันที่ {formatThaiDateText(selectedDate)}</span>
                      </div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        พบข้อมูลการลงเวลา: <b className="font-mono text-rose-600 text-xs">{dateAttendanceCount}</b> รายการ (รวมเวลามา, กลับ, ลา, ราชการ)
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteDateAttendance}
                      disabled={actionLoading || dateAttendanceCount === 0}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบข้อมูลวันที่นี้</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION C: ลบข้อมูลการลงเวลาทั้งหมด */}
              <div className="bg-rose-50/60 rounded-2xl border-2 border-rose-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-rose-800 pb-2 border-b border-rose-200">
                  <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-rose-900">
                      ลบข้อมูลการลงเวลา : ทั้งหมดในระบบ
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      ล้างข้อมูลการลงเวลาปฏิบัติงาน, การลา, ไปราชการของครูทุกคนในระบบ
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">จำนวนข้อมูลการลงเวลาทั้งหมดในระบบ:</span>
                    <span className="font-mono font-extrabold text-base text-rose-600">
                      {totalAttendanceCount} รายการ
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    * เมื่อกดยืนยัน ข้อมูลการลงเวลาทั้งหมดจะถูกลบออกจากฐานข้อมูล Firebase
                    ทันทีโดยไม่กระทบกับบัญชีรายชื่อคุณครู
                  </div>
                </div>

                {/* Confirmation Input Guard */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-rose-900">
                    พิมพ์คำว่า <span className="underline font-mono bg-white px-1.5 py-0.5 rounded border border-rose-300 text-rose-600">DELETE</span> หรือรหัส PIN ผู้ดูแลระบบ ({config.adminPin || '000000'}) เพื่อยืนยัน:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="พิมพ์ DELETE หรือ PIN..."
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-rose-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-rose-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleDeleteAllAttendance}
                      disabled={actionLoading || totalAttendanceCount === 0 || !confirmText}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 disabled:from-slate-300 disabled:to-slate-300 text-white text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>ลบข้อมูลทั้งหมด</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ประวัติระบบ Logs (รายเดือน / ทั้งหมด) */}
          {activeCategory === 'logs' && (
            <div className="space-y-6">
              {/* SECTION A: ลบประวัติระบบรายเดือน */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                      ลบประวัติระบบ (Logs) : รายเดือน
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      เลือกลบประวัติการทำงานของระบบตามเดือนที่ระบุออกจากฐานข้อมูล
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      เลือกเดือน:
                    </label>
                    <select
                      value={logMonthNum}
                      onChange={(e) => setLogMonthNum(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {THAI_MONTHS_SELECT.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      เลือกปี พ.ศ.:
                    </label>
                    <select
                      value={logYearBE}
                      onChange={(e) => setLogYearBE(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-800 bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {[2567, 2568, 2569, 2570, 2571, 2572].map((y) => (
                        <option key={y} value={y}>
                          พ.ศ. {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Month Status Card */}
                <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-sky-950">
                      {logMonthDisplay}
                    </div>
                    <div className="text-[11px] text-sky-700">
                      พบประวัติระบบ: <b className="font-mono">{monthLogsCount}</b> รายการ
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteLogsByMonth}
                    disabled={actionLoading || monthLogsCount === 0}
                    className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบประวัติเดือนนี้</span>
                  </button>
                </div>
              </div>

              {/* SECTION B: ลบประวัติระบบทั้งหมด */}
              <div className="bg-rose-50/60 rounded-2xl border-2 border-rose-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-rose-800 pb-2 border-b border-rose-200">
                  <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-rose-900">
                      ลบประวัติระบบ (Logs) : ทั้งหมด
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      ล้างประวัติการใช้งานและการบันทึกทั้งหมดของระบบออกจากฐานข้อมูล
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="text-slate-700 font-bold">
                      ประวัติระบบทั้งหมดในฐานข้อมูล
                    </div>
                    <div className="text-[11px] text-slate-500">
                      บันทึกการกระทำ การล็อกอิน และการลงเวลาในอดีต
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-base text-rose-600">
                    {totalLogsCount} รายการ
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDeleteAllLogs}
                    disabled={actionLoading || totalLogsCount === 0}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ลบประวัติระบบทั้งหมด</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-rose-600 font-semibold text-[11px]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>* ทุกการลบจะลบข้อมูลออกจากฐานข้อมูล Firebase โดยตรง</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
