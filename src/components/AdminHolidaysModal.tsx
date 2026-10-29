import React, { useState, useEffect } from 'react';
import {
  Calendar,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  Briefcase,
  Coffee
} from 'lucide-react';
import { HolidaySetting, HolidaysConfigMap } from '../types';
import {
  getSchoolHolidays,
  saveSchoolHoliday,
  removeSchoolHoliday,
  saveBatchHolidays
} from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { getBangkokParts } from '../utils/internetTime';

interface AdminHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUsername: string;
  onHolidaysChange?: (map: HolidaysConfigMap) => void;
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Official Thai Public Holidays Template (can be mapped to any year)
export const OFFICIAL_THAI_HOLIDAYS_TEMPLATE: { month: string; day: string; name: string }[] = [
  { month: '01', day: '01', name: 'วันขึ้นปีใหม่' },
  { month: '02', day: '12', name: 'วันมาฆบูชา (โดยประมาณ)' },
  { month: '04', day: '06', name: 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกฯ และวันที่ระลึกมหาจักรีบรมราชวงศ์' },
  { month: '04', day: '13', name: 'วันสงกรานต์' },
  { month: '04', day: '14', name: 'วันสงกรานต์' },
  { month: '04', day: '15', name: 'วันสงกรานต์' },
  { month: '05', day: '01', name: 'วันแรงงานแห่งชาติ' },
  { month: '05', day: '04', name: 'วันฉัตรมงคล' },
  { month: '05', day: '11', name: 'วันวิสาขบูชา (โดยประมาณ)' },
  { month: '06', day: '03', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
  { month: '07', day: '10', name: 'วันอาสาฬหบูชา (โดยประมาณ)' },
  { month: '07', day: '11', name: 'วันเข้าพรรษา (โดยประมาณ)' },
  { month: '07', day: '28', name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว' },
  { month: '08', day: '12', name: 'วันแม่แห่งชาติ / วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง' },
  { month: '10', day: '13', name: 'วันนวมินทรมหาราช' },
  { month: '10', day: '23', name: 'วันปิยมหาราช' },
  { month: '12', day: '05', name: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ / วันชาติ' },
  { month: '12', day: '10', name: 'วันรัฐธรรมนูญ' },
  { month: '12', day: '31', name: 'วันสิ้นปี' }
];

export const AdminHolidaysModal: React.FC<AdminHolidaysModalProps> = ({
  isOpen,
  onClose,
  adminUsername,
  onHolidaysChange
}) => {
  const bkk = getBangkokParts();
  const currentCE = bkk.year;
  const currentMonthNum = String(bkk.month).padStart(2, '0');

  const [selectedYearBE, setSelectedYearBE] = useState<number>(currentCE + 543);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>(currentMonthNum);
  const [holidaysMap, setHolidaysMap] = useState<HolidaysConfigMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Selected date for day details editing
  const [activeDateModal, setActiveDateModal] = useState<{
    dateStr: string;
    dayNum: number;
    dayOfWeekName: string;
    isWeekend: boolean;
    currentOverride?: HolidaySetting;
  } | null>(null);

  const [customHolidayName, setCustomHolidayName] = useState<string>('');

  const selectedYearCE = selectedYearBE - 543;
  const currentYearMonth = `${selectedYearCE}-${selectedMonthNum}`;

  // Fetch holidays from Firebase
  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await getSchoolHolidays();
      setHolidaysMap(data || {});
    } catch (err) {
      console.error('Error loading school holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHolidays();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Month navigation
  const handlePrevMonth = () => {
    let m = parseInt(selectedMonthNum, 10) - 1;
    let y = selectedYearBE;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonthNum(String(m).padStart(2, '0'));
    setSelectedYearBE(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonthNum, 10) + 1;
    let y = selectedYearBE;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonthNum(String(m).padStart(2, '0'));
    setSelectedYearBE(y);
  };

  // Determine days in the selected month
  const mIndex = parseInt(selectedMonthNum, 10);
  const daysInMonth = new Date(selectedYearCE, mIndex, 0).getDate();
  const firstDayOfWeek = new Date(selectedYearCE, mIndex - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...

  const thaiDaysShort = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const thaiDaysFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  // Handle open day editor
  const handleDayClick = (dayNum: number) => {
    const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
    const dayDate = new Date(selectedYearCE, mIndex - 1, dayNum);
    const dayOfWeekIndex = dayDate.getDay();
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
    const currentOverride = holidaysMap[dateStr];

    setActiveDateModal({
      dateStr,
      dayNum,
      dayOfWeekName: thaiDaysFull[dayOfWeekIndex],
      isWeekend,
      currentOverride
    });
    setCustomHolidayName(currentOverride?.name || (isWeekend ? 'วันหยุดสุดสัปดาห์' : 'วันหยุด'));
  };

  // Save Holiday (กำหนดเฉพาะวันหยุด)
  const handleSaveHoliday = async () => {
    if (!activeDateModal) return;
    setActionLoading(true);

    try {
      const setting: HolidaySetting = {
        date: activeDateModal.dateStr,
        name: customHolidayName.trim() || 'วันหยุด',
        isHoliday: true
      };

      await saveSchoolHoliday(setting, adminUsername);
      const nextMap = { ...holidaysMap, [setting.date]: setting };
      setHolidaysMap(nextMap);
      if (onHolidaysChange) onHolidaysChange(nextMap);
      setActiveDateModal(null);
      Swal.fire({
        title: 'บันทึกวันหยุดสำเร็จ!',
        text: `กำหนดวันที่ ${activeDateModal.dateStr} เป็น "วันหยุด (${setting.name})" เรียบร้อยแล้ว`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: unknown) {
      Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel holiday / Reset to default
  const handleResetDaySetting = async () => {
    if (!activeDateModal) return;
    setActionLoading(true);

    try {
      await removeSchoolHoliday(activeDateModal.dateStr, adminUsername);
      const next = { ...holidaysMap };
      delete next[activeDateModal.dateStr];
      setHolidaysMap(next);
      if (onHolidaysChange) onHolidaysChange(next);
      setActiveDateModal(null);
      Swal.fire({
        title: 'ยกเลิกสำเร็จ!',
        text: `ยกเลิกวันหยุดวันที่ ${activeDateModal.dateStr} เรียบร้อยแล้ว (กลับเป็นวันทำการปกติ)`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: unknown) {
      Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Auto-fill official Thai holidays for the whole year
  const handleAutoFillThaiHolidays = async () => {
    const res = await Swal.fire({
      title: 'เติมวันหยุดนักขัตฤกษ์อัตโนมัติ?',
      html: `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>ระบบจะเพิ่มวันหยุดนักขัตฤกษ์และวันสำคัญทางราชการของไทยประจำปี พ.ศ. <b>${selectedYearBE}</b> ให้อัตโนมัติ (เช่น วันสงกรานต์, วันปิยมหาราช, วันพ่อ, วันแม่, วันสิ้นปี ฯลฯ)</p>
          <p class="text-purple-700 font-bold">* เสาร์-อาทิตย์ยังคงหยุดอัตโนมัติเช่นเดิม</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันเติมวันหยุด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED'
    });

    if (!res.isConfirmed) return;
    setActionLoading(true);

    try {
      const updatedMap = { ...holidaysMap };
      OFFICIAL_THAI_HOLIDAYS_TEMPLATE.forEach((tpl) => {
        const dateStr = `${selectedYearCE}-${tpl.month}-${tpl.day}`;
        updatedMap[dateStr] = {
          date: dateStr,
          name: tpl.name,
          isHoliday: true,
          updatedBy: adminUsername,
          updatedAt: new Date().toISOString()
        };
      });

      await saveBatchHolidays(updatedMap, adminUsername);
      setHolidaysMap(updatedMap);
      Swal.fire('สำเร็จ', `อัปเดตวันหยุดนักขัตฤกษ์ประจำปี ${selectedYearBE} เรียบร้อยแล้ว`, 'success');
    } catch (err: unknown) {
      Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset month custom overrides
  const handleResetMonth = async () => {
    const res = await Swal.fire({
      title: 'รีเซ็ตเดือนนี้เป็นค่าเริ่มต้น?',
      text: `คืนค่าทุกวันในเดือน ${THAI_MONTH_NAMES[mIndex - 1]} ${selectedYearBE} ให้เสาร์-อาทิตย์หยุด และจันทร์-ศุกร์เป็นวันทำการตามปกติ`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันรีเซ็ต',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444'
    });

    if (!res.isConfirmed) return;
    setActionLoading(true);

    try {
      const updatedMap = { ...holidaysMap };
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYearMonth}-${String(d).padStart(2, '0')}`;
        delete updatedMap[dateStr];
      }
      await saveBatchHolidays(updatedMap, adminUsername);
      setHolidaysMap(updatedMap);
      Swal.fire('สำเร็จ', 'รีเซ็ตการตั้งค่าเดือนนี้เรียบร้อยแล้ว', 'success');
    } catch (err: unknown) {
      Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Month Statistics
  let monthWorkdaysCount = 0;
  let monthHolidaysCount = 0;
  const monthCustomHolidays: { dateStr: string; day: number; name: string }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYearMonth}-${String(d).padStart(2, '0')}`;
    const dayDate = new Date(selectedYearCE, mIndex - 1, d);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const override = holidaysMap[dateStr];

    const isHoliday = isWeekend || (override !== undefined && override.isHoliday);
    if (override !== undefined && override.isHoliday && !isWeekend) {
      monthCustomHolidays.push({ dateStr, day: d, name: override.name });
    }

    if (isHoliday) {
      monthHolidaysCount++;
    } else {
      monthWorkdaysCount++;
    }
  }

  const selectedMonthThaiName = THAI_MONTH_NAMES[mIndex - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                กำหนดวันหยุด (School Holidays)
              </h2>
              <p className="text-[11px] sm:text-xs text-purple-100 font-medium">
                เสาร์-อาทิตย์เป็นวันหยุดอัตโนมัติ • คลิกที่วันเพื่อกำหนดเป็นวันหยุดหรือยกเลิกวันหยุด
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-slate-700">
          {/* Controls Bar: Month / Year Picker & Action Tools */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100">
            {/* Month & Year Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-800 shadow-2xs border border-purple-200 transition-colors cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
                <span className="text-sm font-extrabold text-purple-950">
                  {selectedMonthThaiName}
                </span>
                <span className="text-sm font-bold font-mono text-purple-700">
                  พ.ศ. {selectedYearBE}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-800 shadow-2xs border border-purple-200 transition-colors cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={loadHolidays}
                disabled={loading || actionLoading}
                className="p-1.5 rounded-xl bg-white hover:bg-purple-100 text-[#7C3AED] shadow-2xs border border-purple-200 transition-colors cursor-pointer ml-1"
                title="โหลดข้อมูลใหม่"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAutoFillThaiHolidays}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="ใส่ข้อมูลวันหยุดนักขัตฤกษ์ทางการไทยให้อัตโนมัติ"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>เติมวันหยุดราชการอัตโนมัติ</span>
              </button>

              <button
                onClick={handleResetMonth}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-bold transition-all border border-rose-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="รีเซ็ตเดือนนี้กลับเป็นค่าเริ่มต้น (เสาร์-อาทิตย์หยุด, จันทร์-ศุกร์ทำงาน)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>รีเซ็ตเดือนนี้</span>
              </button>
            </div>
          </div>

          {/* Month Stats Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-extrabold font-mono text-emerald-900">{monthWorkdaysCount} วัน</div>
                <div className="text-[11px] text-emerald-700 font-medium">วันทำการในเดือนนี้</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-extrabold font-mono text-amber-900">{monthHolidaysCount} วัน</div>
                <div className="text-[11px] text-amber-700 font-medium">วันหยุดในเดือนนี้</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-extrabold font-mono text-purple-900">{daysInMonth} วัน</div>
                <div className="text-[11px] text-purple-700 font-medium">จำนวนวันทั้งหมด</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-extrabold font-mono text-rose-900">{monthCustomHolidays.length} วัน</div>
                <div className="text-[11px] text-rose-700 font-medium">วันหยุดที่กำหนดเพิ่ม</div>
              </div>
            </div>
          </div>

          {/* Interactive Calendar Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[11px] sm:text-xs font-bold text-slate-600">
              {thaiDaysShort.map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`py-1.5 rounded-lg ${
                    idx === 0 || idx === 6 ? 'text-rose-600 bg-rose-50/70' : 'text-slate-700 bg-slate-50'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Empty leading offset cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[82px] bg-slate-50/40 rounded-xl" />
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
                const dayDate = new Date(selectedYearCE, mIndex - 1, dayNum);
                const dayOfWeek = dayDate.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const override = holidaysMap[dateStr];

                const isAddedHoliday = !isWeekend && override !== undefined && override.isHoliday;
                const isHoliday = isWeekend || isAddedHoliday;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDayClick(dayNum)}
                    className={`min-h-[68px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between group hover:scale-[1.02] hover:shadow-md ${
                      isAddedHoliday
                        ? 'bg-rose-50/90 border-rose-400 text-rose-900 ring-2 ring-rose-300/60'
                        : isHoliday
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                        : 'bg-white border-slate-200 hover:border-purple-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm font-extrabold font-mono w-6 h-6 rounded-lg flex items-center justify-center ${
                          isAddedHoliday
                            ? 'bg-rose-600 text-white'
                            : isHoliday
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-800 group-hover:bg-purple-100 group-hover:text-purple-800'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {/* Small badge label */}
                      <span className="text-[9px] font-bold truncate max-w-[65px] hidden sm:inline">
                        {isAddedHoliday
                          ? 'วันหยุด'
                          : isHoliday
                          ? 'หยุด ส.-อา.'
                          : 'วันทำการ'}
                      </span>
                    </div>

                    {/* Holiday / Note description */}
                    <div className="w-full mt-1">
                      {override?.name ? (
                        <div
                          className="text-[9px] sm:text-[10px] font-bold line-clamp-2 leading-tight text-rose-700"
                          title={override.name}
                        >
                          {override.name}
                        </div>
                      ) : isHoliday ? (
                        <div className="text-[9px] text-amber-700/80 font-medium">หยุดประจำสัปดาห์</div>
                      ) : (
                        <div className="text-[9px] text-slate-400 font-medium">เปิดทำการปกติ</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Legend & Guide */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-600 border border-slate-200">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-slate-700">คำอธิบายสี:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white border border-slate-300" /> วันทำการปกติ (จ.-ศ.)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> วันหยุดประจำสัปดาห์ (ส.-อา.)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" /> วันหยุดที่กำหนด (วันหยุดราชการ / โรงเรียน)
              </span>
            </div>
            <div className="text-[10px] text-purple-700 font-semibold">
              * แตะที่วันใดก็ได้เพื่อกำหนดหรือยกเลิกวันหยุด
            </div>
          </div>

          {/* Custom Holidays List for this month */}
          {monthCustomHolidays.length > 0 && (
            <div className="bg-rose-50/50 rounded-2xl border border-rose-100 p-3.5 space-y-2">
              <h4 className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-rose-600" />
                รายการวันหยุดที่กำหนดในเดือน {selectedMonthThaiName} ({monthCustomHolidays.length} วัน)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {monthCustomHolidays.map((item) => (
                  <div
                    key={item.dateStr}
                    className="p-2.5 bg-white rounded-xl border border-rose-100 shadow-2xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        วันที่ {item.day} {selectedMonthThaiName}
                      </div>
                      <div className="text-[11px] font-semibold text-rose-600">
                        {item.name}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      วันหยุด
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            ระบบบันทึกข้อมูลแบบ Real-time ลง Firestore
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Day Edit Action Modal */}
      {activeDateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-purple-200 p-5 sm:p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-full">
                  กำหนดวันหยุด
                </span>
                <h3 className="text-base font-extrabold text-slate-800 mt-1">
                  {activeDateModal.dayOfWeekName}ที่ {activeDateModal.dayNum} {selectedMonthThaiName} {selectedYearBE}
                </h3>
                <p className="text-[11px] font-mono text-slate-400">{activeDateModal.dateStr}</p>
              </div>
              <button
                onClick={() => setActiveDateModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current State Info */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div>
                <b>สถานะปัจจุบัน:</b>{' '}
                {activeDateModal.currentOverride !== undefined && activeDateModal.currentOverride.isHoliday ? (
                  <span className="font-bold text-rose-600">
                    วันหยุด ({activeDateModal.currentOverride.name})
                  </span>
                ) : activeDateModal.isWeekend ? (
                  <span className="font-bold text-amber-700">วันหยุดประจำสัปดาห์ (เสาร์-อาทิตย์ อัตโนมัติ)</span>
                ) : (
                  <span className="font-bold text-emerald-700">วันทำการตามปกติ (จันทร์-ศุกร์ อัตโนมัติ)</span>
                )}
              </div>
            </div>

            {/* Name/Reason Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อวันหยุด / หมายเหตุ
              </label>
              <input
                type="text"
                value={customHolidayName}
                onChange={(e) => setCustomHolidayName(e.target.value)}
                placeholder="เช่น วันหยุดนักขัตฤกษ์, วันหยุดสถานศึกษา..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-xs bg-slate-50/50"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {/* Option 1: Set as Holiday */}
              <button
                onClick={handleSaveHoliday}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Coffee className="w-4 h-4" />
                <span>บันทึกเป็น "วันหยุด"</span>
              </button>

              {/* Option 2: Reset to default */}
              {activeDateModal.currentOverride !== undefined && (
                <button
                  onClick={handleResetDaySetting}
                  disabled={actionLoading}
                  className="w-full py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ยกเลิกวันหยุด (คืนค่าเป็นวันทำการปกติ)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
