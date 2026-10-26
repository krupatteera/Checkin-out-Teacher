import React, { useEffect, useState } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Clock,
  CalendarOff,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Check
} from 'lucide-react';
import { SchoolConfig, UserAccount, HolidaysConfigMap } from '../types';
import { getAttendanceByDateRange, getSchoolHolidays } from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { getInternetIsoDate, getInternetNow, getBangkokParts, formatThaiDateFromIso, getInternetTimeString, getInternetClockParts } from '../utils/internetTime';

interface TeacherReportProps {
  user: UserAccount;
  config: SchoolConfig;
}

export const THAI_MONTHS = [
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

export function formatThaiDateText(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const mIndex = parseInt(m, 10) - 1;
  const thaiYear = parseInt(y, 10) + 543;
  const day = parseInt(d, 10);
  return `${day} ${thaiMonths[mIndex] || ''} ${thaiYear}`;
}

/**
 * Format leave text for table display:
 * Shows ONLY the leave category/type and period (e.g. "ลากิจ (เต็มวัน)", "ลาป่วย")
 * Strips reason/details and contact phone number as requested.
 */
export function formatTableLeaveDisplay(rawNote?: string): string {
  if (!rawNote || rawNote.trim() === '-' || !rawNote.trim()) return '-';
  let clean = rawNote.trim();
  clean = clean.replace(/\[?เบอร์ติดต่อ[\s\S]*?\]?$/i, '').trim();
  if (clean.includes(':')) {
    clean = clean.split(':')[0].trim();
  }
  return clean || 'ลาหยุด';
}

/**
 * Format official duty text for table display:
 * Shows ONLY the duty category/type and period (e.g. "ประชุมราชการ / สัมมนา (เต็มวัน)", "ไปราชการ")
 * Strips location, orders, and mission details as requested.
 */
export function formatTableOfficialDisplay(rawNote?: string): string {
  if (!rawNote || rawNote.trim() === '-' || !rawNote.trim()) return '-';
  let clean = rawNote.trim();
  if (clean.includes(':')) {
    clean = clean.split(':')[0].trim();
  }
  return clean || 'ไปราชการ';
}

interface DayAttendanceRow {
  date: string;
  dateThai: string;
  dayOfWeekThai: string;
  teacherName: string;
  timeIn: string;
  isLate: boolean;
  timeOut: string;
  isEarly: boolean;
  leave: string;
  official: string;
  hasRecord: boolean;
  isHoliday: boolean;
  holidayName: string;
}

// Evaluate whether a date is a holiday based on admin holiday settings and default weekend rules
export function evaluateDayHolidayStatus(
  dateStr: string,
  holidaysMap: HolidaysConfigMap
): { isHoliday: boolean; holidayName: string; isSpecialOverride: boolean } {
  if (!dateStr) {
    return { isHoliday: false, holidayName: '', isSpecialOverride: false };
  }
  const cleanDate = dateStr.trim();
  const parts = cleanDate.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  // Use UTC to ensure day of the week is 100% immune to device timezone or local clock
  const dayOfWeek = new Date(Date.UTC(y, m, d)).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const override = holidaysMap ? (holidaysMap[cleanDate] || holidaysMap[dateStr]) : undefined;

  if (override !== undefined) {
    // If admin explicitly set as working day -> allow attendance immediately!
    if (override.isHoliday === false) {
      return {
        isHoliday: false,
        holidayName: override.name || 'วันทำการพิเศษ (เปิดทำการ)',
        isSpecialOverride: true
      };
    }
    if (override.isHoliday === true) {
      return {
        isHoliday: true,
        holidayName: override.name || (isWeekend ? 'วันหยุดสุดสัปดาห์' : 'วันหยุดโรงเรียน/ราชการ'),
        isSpecialOverride: true
      };
    }
  }

  if (isWeekend) {
    return {
      isHoliday: true,
      holidayName: 'วันหยุดสุดสัปดาห์',
      isSpecialOverride: false
    };
  }

  return {
    isHoliday: false,
    holidayName: '',
    isSpecialOverride: false
  };
}

// Helper to format Date to YYYY-MM-DD
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const TeacherReport: React.FC<TeacherReportProps> = ({ user, config }) => {
  const bkkNow = getBangkokParts();
  const currentYearCE = bkkNow.year;
  const currentMonthNum = String(bkkNow.month).padStart(2, '0');

  // Default date range: 1st of current month to current day (strictly from internet time)
  const defaultStartDate = `${currentYearCE}-${currentMonthNum}-01`;
  const defaultEndDate = getInternetIsoDate();

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [loading, setLoading] = useState<boolean>(false);
  const [reportRows, setReportRows] = useState<DayAttendanceRow[]>([]);
  const [showOnlyWeekdays, setShowOnlyWeekdays] = useState<boolean>(true);

  // Stats (ปรับปรุงให้สอดคล้องกับระบบลงเวลากลับ, ลา, ไปราชการ)
  const [stats, setStats] = useState({
    totalOut: 0,
    totalNormalOut: 0,
    totalEarly: 0,
    totalLeave: 0,
    totalOfficial: 0,
    totalHolidays: 0,
    totalReportDays: 0
  });

  // Preset Date Range shortcuts strictly calculated with internet baseline
  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days') => {
    const bkk = getBangkokParts();
    if (preset === 'this_month') {
      const y = bkk.year;
      const m = String(bkk.month).padStart(2, '0');
      const lastDay = new Date(Date.UTC(y, bkk.month, 0)).getUTCDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_month') {
      let prevM = bkk.month - 1;
      let prevY = bkk.year;
      if (prevM === 0) {
        prevM = 12;
        prevY -= 1;
      }
      const m = String(prevM).padStart(2, '0');
      const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
      setStartDate(`${prevY}-${m}-01`);
      setEndDate(`${prevY}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_7_days') {
      const past7Epoch = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const p = getBangkokParts(past7Epoch);
      setStartDate(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
      setEndDate(getInternetIsoDate());
    } else if (preset === 'last_30_days') {
      const past30Epoch = Date.now() - 29 * 24 * 60 * 60 * 1000;
      const p = getBangkokParts(past30Epoch);
      setStartDate(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
      setEndDate(getInternetIsoDate());
    }
  };

  const fetchTeacherRecords = async (start: string, end: string) => {
    if (!start || !end) return;
    if (start > end) {
      Swal.fire('ข้อผิดพลาด', 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด', 'warning');
      return;
    }

    setLoading(true);
    try {
      const [records, holidaysData] = await Promise.all([
        getAttendanceByDateRange(start, end),
        getSchoolHolidays()
      ]);
      const holidaysMap: HolidaysConfigMap = holidaysData || {};

      // Filter records belonging to this teacher
      const myRecords = (records || []).filter(
        (r) => r.userId === user.id || r.userId === user.username
      );

      const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

      const rows: DayAttendanceRow[] = [];
      let countOut = 0;
      let countNormalOut = 0;
      let countEarly = 0;
      let countLeave = 0;
      let countOfficial = 0;
      let countHolidays = 0;

      // Iterate day-by-day between start and end
      const curr = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);

      while (curr <= last) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const dayOfWeekIndex = curr.getDay(); // 0 = Sun, 1 = Mon ...
        const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

        const dayRecords = myRecords.filter((r) => r.date === dateStr);
        const hasRecord = dayRecords.length > 0;

        // ตรวจสอบสถานะวันหยุดตามการตั้งค่าของผู้ดูแลระบบ
        const holidayStatus = evaluateDayHolidayStatus(dateStr, holidaysMap);
        const isHoliday = holidayStatus.isHoliday;
        const holidayName = holidayStatus.holidayName;

        if (showOnlyWeekdays && isWeekend && !hasRecord && !holidayStatus.isSpecialOverride) {
          curr.setDate(curr.getDate() + 1);
          continue;
        }

        const dayOfWeek = thaiDays[dayOfWeekIndex];

        let timeIn = '-';
        let isLate = false;
        let timeOut = '-';
        let isEarly = false;
        let leaveNote = '-';
        let officialNote = '-';

        if (hasRecord) {
          dayRecords.forEach((r) => {
            if (r.action === 'OUT') {
              timeOut = `${r.time} น.`;
              if (r.isEarly) {
                isEarly = true;
              } else if (config.earlyTime && r.time < config.earlyTime) {
                isEarly = true;
              }
            }
            if (r.action === 'LEAVE') {
              leaveNote = formatTableLeaveDisplay(r.note);
            }
            if (r.action === 'OFFICIAL') {
              officialNote = formatTableOfficialDisplay(r.note);
            }
          });
        } else if (isHoliday) {
          timeOut = 'วันหยุด';
        }

        // สรุปสถิติ (นับวันเมื่อมีข้อมูลลงเวลากลับจริง)
        if (timeOut !== '-' && timeOut !== 'วันหยุด') {
          countOut++;
          if (isEarly) {
            countEarly++;
          } else {
            countNormalOut++;
          }
        }
        if (leaveNote !== '-') countLeave++;
        if (officialNote !== '-') countOfficial++;
        if (isHoliday && !hasRecord) countHolidays++;

        rows.push({
          date: dateStr,
          dateThai: formatThaiDateText(dateStr),
          dayOfWeekThai: dayOfWeek,
          teacherName: user.fullname,
          timeIn,
          isLate,
          timeOut,
          isEarly,
          leave: leaveNote,
          official: officialNote,
          hasRecord,
          isHoliday,
          holidayName
        });

        curr.setDate(curr.getDate() + 1);
      }

      setStats({
        totalOut: countOut,
        totalNormalOut: countNormalOut,
        totalEarly: countEarly,
        totalLeave: countLeave,
        totalOfficial: countOfficial,
        totalHolidays: countHolidays,
        totalReportDays: rows.length
      });

      setReportRows(rows);
    } catch (err) {
      console.error('Error fetching teacher records by date range:', err);
      Swal.fire('ผิดพลาด', 'ไม่สามารถดึงข้อมูลรายงานการลงเวลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherRecords(startDate, endDate);
  }, [startDate, endDate, showOnlyWeekdays]);

  // Print Document Trigger
  const handlePrintDocument = () => {
    window.print();
  };

  const startDateThai = formatThaiDateText(startDate);
  const endDateThai = formatThaiDateText(endDate);
  const dateRangeDisplay = startDate === endDate
    ? `ประจำวันที่ ${startDateThai}`
    : `ระหว่างวันที่ ${startDateThai} ถึง วันที่ ${endDateThai}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Print-specific style overrides */}
      <style>{`
        @media print {
          /* Hide everything outside the report document */
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, aside, nav, .floating-bottom-nav, .no-print {
            display: none !important;
          }
          .lg\\:pl-72 {
            padding-left: 0 !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-black-text {
            color: #000000 !important;
          }
          .print-black-table {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
            color: #000000 !important;
          }
          .print-black-table th, .print-black-table td {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            padding: 5px 6px !important;
          }
          .print-black-table th {
            background-color: #f2f2f2 !important;
            font-weight: 700 !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm 6mm !important;
          }
        }
      `}</style>

      {/* Top Filter & Actions Card (Hidden during print) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold mb-1 border border-purple-200">
              <FileText className="w-3.5 h-3.5 text-[#7C3AED]" /> เมนูรายงานการลงเวลาสำหรับครู
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">
              รายงานการลงเวลาปฏิบัติงาน (กำหนดช่วงวันที่เริ่มต้น - สิ้นสุด)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ข้อมูล{dateRangeDisplay} • คุณครู {user.fullname} • รวม {reportRows.length} รายการ
            </p>
          </div>

          {/* Print PDF Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTeacherRecords(startDate, endDate)}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 bg-purple-50 hover:bg-purple-100 text-[#7C3AED] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-purple-200"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            <button
              onClick={handlePrintDocument}
              className="px-4 py-2 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer group"
            >
              <Printer className="w-4 h-4 group-hover:scale-110 transition-transform text-white" />
              <span>พิมพ์เอกสาร (PDF)</span>
            </button>
          </div>
        </div>

        {/* Date Range Selectors & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">วันที่เริ่มต้น:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 font-mono focus:outline-none cursor-pointer"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">ถึงวันที่:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 font-mono focus:outline-none cursor-pointer"
              />
            </div>

            {/* Weekdays Filter Toggle */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <input
                type="checkbox"
                checked={showOnlyWeekdays}
                onChange={(e) => setShowOnlyWeekdays(e.target.checked)}
                className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] cursor-pointer"
              />
              <span>เฉพาะวันจันทร์ - ศุกร์ (วันทำการ)</span>
            </label>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">เลือกด่วน:</span>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] text-[11px] font-bold transition-colors cursor-pointer border border-purple-200"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
            >
              เดือนที่แล้ว
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_7_days')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
            >
              7 วันล่าสุด
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_30_days')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
            >
              30 วันล่าสุด
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats (Hidden during print - แสดงสถิติการลงเวลากลับ ลา ไปราชการ) */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-800">{stats.totalOut}</div>
            <div className="text-[11px] text-slate-500 font-medium">ลงเวลากลับ (วัน)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-emerald-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-600">{stats.totalNormalOut}</div>
            <div className="text-[11px] text-slate-500 font-medium">กลับตรงเวลา (ครั้ง)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-orange-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-orange-600">{stats.totalEarly}</div>
            <div className="text-[11px] text-slate-500 font-medium">กลับก่อนเวลา (ครั้ง)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-700">{stats.totalHolidays}</div>
            <div className="text-[11px] text-slate-500 font-medium">วันหยุด (วัน)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-sky-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <CalendarOff className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-sky-600">{stats.totalLeave}</div>
            <div className="text-[11px] text-slate-500 font-medium">ลาหยุด (ครั้ง)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-purple-700">{stats.totalOfficial}</div>
            <div className="text-[11px] text-slate-500 font-medium">ไปราชการ (ครั้ง)</div>
          </div>
        </div>
      </div>

      {/* Main Document Box (Strictly Black Text, Black Borders for Official Government Standard) */}
      <div className="print-container bg-white rounded-2xl sm:rounded-3xl border border-black shadow-md overflow-hidden text-black">
        {/* หัวกระดาษ: ชื่อโรงเรียน, ชื่อระบบ, ข้อมูลช่วงวันที่ */}
        <div className="p-5 sm:p-6 border-b border-black text-center space-y-1 bg-white">
          <h2 className="text-lg sm:text-xl font-extrabold text-black tracking-tight print-black-text">
            {config.orgName || 'โรงเรียนบ้านดุงวิทยา'}
          </h2>
          <h3 className="text-sm sm:text-base font-bold text-black print-black-text">
            {config.systemName || 'ระบบลงเวลาปฏิบัติงานออนไลน์สำหรับครูและบุคลากรทางการศึกษา'}
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-black print-black-text pt-0.5">
            รายงานการลงเวลาปฏิบัติงาน {dateRangeDisplay}
          </p>
          <div className="pt-2 text-xs text-black flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-black/40 mt-3 print-black-text">
            <span><b>ชื่อครูผู้รายงาน:</b> {user.fullname}</span>
            <span><b>ตำแหน่ง:</b> {user.position || 'ครูผู้สอน'}</span>
            <span><b>สังกัด/กลุ่มสาระ:</b> {user.department || config.orgAffiliation || '-'}</span>
          </div>
          <div className="pt-2 text-[11px] font-bold text-black border-t border-dashed border-black/30 mt-2 flex items-center justify-center gap-1">
            <span>พิมพ์เอกสารเมื่อวันที่/เวลา (แบบละเอียด): {getInternetClockParts().thaiDate} เวลา {getInternetTimeString()} น. (ระบบเวลามาตรฐานอินเทอร์เน็ต / NIMT)</span>
          </div>
        </div>

        {/* Info toolbar (Hidden during print) */}
        <div className="no-print px-4 py-2.5 border-b border-black/20 bg-slate-50 flex items-center justify-between gap-3 text-xs">
          <div className="text-xs font-bold text-slate-700">
            {dateRangeDisplay} (รวม {reportRows.length} รายการในตาราง)
          </div>

          <div className="text-[11px] text-black font-semibold hidden sm:flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-black" />
            <span>เอกสารและตารางใช้ตัวหนังสือและเส้นขอบสีดำ</span>
          </div>
        </div>

        {/* Report Table: Columns: (วันที่, ชื่อครู, เวลากลับ, ลา, ไปราชการ) - NO IMAGES IN TABLE & NO 'ขาดงาน' */}
        <div className="overflow-x-auto p-2 sm:p-5">
          <table className="print-black-table w-full text-xs text-left border-collapse border border-black min-w-[580px] text-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-black">
                <th className="border border-black px-3.5 py-2.5 text-center font-bold text-black w-44">
                  วันที่
                </th>
                <th className="border border-black px-4 py-2.5 text-left font-bold text-black">
                  ชื่อครู
                </th>
                <th className="border border-black px-3 py-2.5 text-center font-bold text-black w-32">
                  เวลากลับ (OUT)
                </th>
                <th className="border border-black px-3 py-2.5 text-center font-bold text-black w-32">
                  ลา
                </th>
                <th className="border border-black px-3 py-2.5 text-center font-bold text-black w-36">
                  ไปราชการ
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="border border-black text-center py-10 text-black">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-black" />
                    กำลังประมวลผลข้อมูลรายงานการลงเวลา...
                  </td>
                </tr>
              ) : reportRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-black text-center py-10 text-black">
                    ไม่พบข้อมูลการลงเวลาในช่วงวันที่กำหนด
                  </td>
                </tr>
              ) : (
                reportRows.map((row) => (
                  <tr
                    key={row.date}
                    className="hover:bg-slate-50 transition-colors text-black"
                  >
                    <td className="border border-black px-3.5 py-2 text-center text-black">
                      <span className="font-bold">{row.dateThai}</span>{' '}
                      <span className="text-[11px] text-black">({row.dayOfWeekThai})</span>
                      {row.isHoliday && (
                        <span className="block text-[10px] text-black font-semibold mt-0.5">
                          {row.holidayName ? `(${row.holidayName})` : '(วันหยุด)'}
                        </span>
                      )}
                    </td>
                    <td className="border border-black px-4 py-2 font-bold text-black">
                      {row.teacherName}
                    </td>
                    <td className="border border-black px-3 py-2 text-center font-bold text-black">
                      {row.isHoliday && !row.hasRecord ? (
                        <span className="inline-block text-black font-extrabold text-[11px]">วันหยุด (ไม่เปิดลงเวลา)</span>
                      ) : (
                        <>
                          <span className="font-mono">{row.timeOut}</span>
                          {row.isEarly && <span className="ml-1 text-[10px] font-bold text-black">(ก่อนเวลา)</span>}
                        </>
                      )}
                    </td>
                    <td className="border border-black px-3 py-2 text-center text-black">
                      {row.leave}
                    </td>
                    <td className="border border-black px-3 py-2 text-center text-black">
                      {row.official}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* สรุปข้อมูลรายงานการปฏิบัติราชการ */}
        <div className="p-4 bg-white border-t border-black text-xs text-black space-y-4">
          <div className="border border-black p-3 bg-white space-y-1">
            <p className="font-bold">
              สรุปผลการปฏิบัติราชการ {dateRangeDisplay} (รวม {reportRows.length} วัน):
            </p>
            <p className="text-[11px]">
              ลงเวลากลับ: <b>{stats.totalOut}</b> วัน &nbsp;|&nbsp;
              กลับตรงเวลา: <b>{stats.totalNormalOut}</b> ครั้ง &nbsp;|&nbsp;
              กลับก่อนเวลา: <b>{stats.totalEarly}</b> ครั้ง &nbsp;|&nbsp;
              วันหยุดตามปฏิทิน: <b>{stats.totalHolidays}</b> วัน &nbsp;|&nbsp;
              ลาหยุด: <b>{stats.totalLeave}</b> ครั้ง &nbsp;|&nbsp;
              ไปราชการ: <b>{stats.totalOfficial}</b> ครั้ง
            </p>
          </div>

          {/* ช่องลงนามรับรองเอกสารราชการ */}
          <div className="mt-8 pt-4 grid grid-cols-2 gap-6 text-center text-xs">
            <div className="space-y-1.5">
              <p>ลงชื่อ ...........................................................</p>
              <p className="font-bold">({user.fullname})</p>
              <p>ตำแหน่ง {user.position || 'ครูผู้สอน'}</p>
              <p className="text-[11px]">ผู้รายงาน</p>
            </div>
            <div className="space-y-1.5">
              <p>ลงชื่อ ...........................................................</p>
              <p className="font-bold">(...........................................................)</p>
              <p>ผู้อำนวยการ{config.orgName}</p>
              <p className="text-[11px]">ผู้รับรองข้อมูล</p>
            </div>
          </div>

          <div className="mt-6 text-right text-[10px] text-black">
            พิมพ์จากระบบเมื่อ: {getInternetClockParts().thaiDate} เวลา {getInternetTimeString()} น. (เวลามาตรฐานอินเทอร์เน็ต)
          </div>
        </div>
      </div>
    </div>
  );
};
