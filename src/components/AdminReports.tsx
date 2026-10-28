import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  FileClock,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  CalendarOff,
  Briefcase,
  Crosshair,
  Trash2,
  PieChart as PieChartIcon,
  ShieldCheck
} from 'lucide-react';
import L from 'leaflet';
import { AttendanceRecord, SchoolConfig, SystemLog, UserAccount } from '../types';
import {
  getAttendanceByDate,
  getAttendanceByMonth,
  getAllUsersList,
  getSystemLogsList,
  cancelAttendanceItem,
  saveAttendanceRecord
} from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { TeacherReport, formatTableLeaveDisplay, formatTableOfficialDisplay } from './TeacherReport';
import { getInternetTimeString, getInternetClockParts, getInternetNow } from '../utils/internetTime';

interface AdminReportsProps {
  user: UserAccount;
  config: SchoolConfig;
  activeView: 'dashboard' | 'summary' | 'map' | 'manual-clock';
  selectedDate: string;
  onDateChange: (d: string) => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  onOpenHolidaysModal?: () => void;
  onOpenDeleteDataModal?: () => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({
  user,
  config,
  activeView,
  selectedDate,
  onDateChange,
  selectedMonth,
  onMonthChange,
  onOpenHolidaysModal,
  onOpenDeleteDataModal
}) => {
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; img?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [subView, setSubView] = useState<'list' | 'individual-report'>('list');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [allUserAccounts, setAllUserAccounts] = useState<UserAccount[]>([]);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Canvas radar ref
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  const fetchDaily = async (date: string) => {
    setLoading(true);
    try {
      const records = await getAttendanceByDate(date);
      setDailyRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonth = async (month: string) => {
    setLoading(true);
    try {
      const records = await getAttendanceByMonth(month);
      setMonthRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const users = await getAllUsersList();
      setAllUsers(users.map((u) => ({ id: u.username || u.id, name: u.fullname, img: u.img })));
      setAllUserAccounts(users);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeView === 'dashboard' || activeView === 'map') {
      fetchDaily(selectedDate);
    } else if (activeView === 'summary') {
      fetchMonth(selectedMonth);
    }
  }, [activeView, selectedDate, selectedMonth]);

  // Aggregate daily records by User
  interface AggregatedUserDay {
    userId: string;
    name: string;
    timeIn: string;
    isLate: boolean;
    timeOut: string;
    isEarly: boolean;
    leaveNote: string;
    leaveRecordId?: string;
    officialNote: string;
    officialRecordId?: string;
    lat?: number;
    lng?: number;
    distance?: number;
    faceSnapshot?: string;
    img?: string;
  }

  const userDayMap: { [uid: string]: AggregatedUserDay } = {};

  dailyRecords.forEach((r) => {
    if (!userDayMap[r.userId]) {
      const uInfo = allUsers.find((u) => u.id === r.userId);
      userDayMap[r.userId] = {
        userId: r.userId,
        name: r.employeeName || uInfo?.name || r.userId,
        timeIn: '-',
        isLate: false,
        timeOut: '-',
        isEarly: false,
        leaveNote: '-',
        officialNote: '-',
        img: uInfo?.img || r.faceSnapshot
      };
    }

    if (r.action === 'IN') {
      userDayMap[r.userId].timeIn = r.time;
      userDayMap[r.userId].isLate = !!r.isLate;
      userDayMap[r.userId].lat = r.lat;
      userDayMap[r.userId].lng = r.lng;
      userDayMap[r.userId].distance = r.distance;
      userDayMap[r.userId].faceSnapshot = r.faceSnapshot;
    } else if (r.action === 'OUT') {
      userDayMap[r.userId].timeOut = r.time;
      userDayMap[r.userId].isEarly = !!r.isEarly;
      if (!userDayMap[r.userId].lat && r.lat) {
        userDayMap[r.userId].lat = r.lat;
        userDayMap[r.userId].lng = r.lng;
        userDayMap[r.userId].distance = r.distance;
      }
    } else if (r.action === 'LEAVE') {
      userDayMap[r.userId].leaveNote = formatTableLeaveDisplay(r.note);
      userDayMap[r.userId].leaveRecordId = r.id;
    } else if (r.action === 'OFFICIAL') {
      userDayMap[r.userId].officialNote = formatTableOfficialDisplay(r.note);
      userDayMap[r.userId].officialRecordId = r.id;
    }
  });

  const dailyList = Object.values(userDayMap);

  // Stats calculation
  const totalIn = dailyList.filter((u) => u.timeIn !== '-').length;
  const totalLate = dailyList.filter((u) => u.isLate).length;
  const totalOut = dailyList.filter((u) => u.timeOut !== '-').length;
  const totalEarly = dailyList.filter((u) => u.isEarly).length;
  const totalLeave = dailyList.filter((u) => u.leaveNote !== '-').length;
  const totalOfficial = dailyList.filter((u) => u.officialNote !== '-').length;

  // Monthly aggregated user statistics
  interface MonthSummaryItem {
    userId: string;
    name: string;
    countIn: number;
    countLate: number;
    countOut: number;
    countEarly: number;
    countLeave: number;
    countOfficial: number;
  }

  const monthSummaryMap: { [uid: string]: MonthSummaryItem } = {};

  monthRecords.forEach((r) => {
    if (!monthSummaryMap[r.userId]) {
      const uInfo = allUsers.find((u) => u.id === r.userId);
      monthSummaryMap[r.userId] = {
        userId: r.userId,
        name: r.employeeName || uInfo?.name || r.userId,
        countIn: 0,
        countLate: 0,
        countOut: 0,
        countEarly: 0,
        countLeave: 0,
        countOfficial: 0
      };
    }

    if (r.action === 'IN') {
      monthSummaryMap[r.userId].countIn += 1;
      if (r.isLate) monthSummaryMap[r.userId].countLate += 1;
    } else if (r.action === 'OUT') {
      monthSummaryMap[r.userId].countOut += 1;
      if (r.isEarly) monthSummaryMap[r.userId].countEarly += 1;
    } else if (r.action === 'LEAVE') {
      monthSummaryMap[r.userId].countLeave += 1;
    } else if (r.action === 'OFFICIAL') {
      monthSummaryMap[r.userId].countOfficial += 1;
    }
  });

  const monthList = Object.values(monthSummaryMap);

  // Setup Leaflet map for 'map' view
  useEffect(() => {
    if (activeView === 'map' && mapContainerRef.current) {
      const centerLat = config.centerLat || 17.413840;
      const centerLng = config.centerLng || 102.787260;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 16);

        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          attribution: '© Google Satellite'
        }).addTo(map);

        // School Center circle with pastel purple styling
        L.circle([centerLat, centerLng], {
          color: '#8B5CF6',
          fillColor: '#C4B5FD',
          fillOpacity: 0.25,
          radius: config.radius || 150
        }).addTo(map);

        const markers = L.layerGroup().addTo(map);
        markersGroupRef.current = markers;
        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.invalidateSize();
      }

      // Update pins
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();

        const bounds: [number, number][] = [];

        dailyList.forEach((log) => {
          if (log.lat && log.lng) {
            bounds.push([log.lat, log.lng]);

            const avatarUrl =
              log.img ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(log.name)}&background=8B5CF6&color=fff`;

            const iconHtml = `
              <div style="width: 44px; height: 44px; position: relative;">
                <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #8B5CF6; box-shadow: 0 4px 10px rgba(139,92,246,0.35); background: #fff;">
                  <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #8B5CF6;"></div>
              </div>
            `;

            const customIcon = L.divIcon({
              className: 'custom-teacher-pin',
              html: iconHtml,
              iconSize: [44, 52],
              iconAnchor: [22, 52],
              popupAnchor: [0, -50]
            });

            const popupContent = `
              <div style="font-family: Sarabun, sans-serif; text-align: center; padding: 6px; min-width: 150px;">
                <img src="${avatarUrl}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; margin: 0 auto 6px; border: 2px solid #C4B5FD;" />
                <div style="font-weight: bold; color: #6D28D9; font-size: 14px;">${log.name}</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">@${log.userId}</div>
                <div style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: #EDE9FE; color: #6D28D9; font-weight: bold; font-size: 11px;">
                  เข้างาน: ${log.timeIn} น.
                </div>
                ${log.distance ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">ห่างจากโรงเรียน: ${log.distance} ม.</div>` : ''}
              </div>
            `;

            if (markersGroupRef.current) {
              L.marker([log.lat, log.lng], { icon: customIcon })
                .bindPopup(popupContent)
                .addTo(markersGroupRef.current);
            }
          }
        });

        if (bounds.length > 0 && mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        }
      }
    }
  }, [activeView, dailyList, config]);

  // Draw Performance Doughnut on canvas
  useEffect(() => {
    if (activeView === 'dashboard' && radarCanvasRef.current) {
      const canvas = radarCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth * dpr : 300 * dpr;
      canvas.height = 200 * dpr;
      ctx.scale(dpr, dpr);

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.clearRect(0, 0, width, height);

      // Doughnut chart drawing
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 25;
      const innerRadius = radius * 0.65;

      const segments = [
        { label: 'กลับตรงเวลา/ปกติ', value: Math.max(0, totalOut - totalEarly), color: '#10B981' },
        { label: 'กลับก่อนเวลา', value: totalEarly, color: '#F57C00' },
        { label: 'ลาหยุด', value: totalLeave, color: '#0288D1' },
        { label: 'ไปราชการ', value: totalOfficial, color: '#8B5CF6' }
      ];

      const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1;
      let startAngle = -Math.PI / 2;

      segments.forEach((seg) => {
        const sliceAngle = (seg.value / sum) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        startAngle += sliceAngle;
      });

      // Center text
      ctx.fillStyle = '#7C3AED';
      ctx.font = 'bold 22px Sarabun';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${totalOut}`, centerX, centerY - 8);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Sarabun';
      ctx.fillText('คนลงเวลากลับ', centerX, centerY + 14);
    }
  }, [activeView, totalOut, totalEarly, totalLeave, totalOfficial]);

  const handleCancelLeave = async (item: AggregatedUserDay) => {
    if (!item.leaveRecordId) return;

    const res = await Swal.fire({
      title: 'ยกเลิกการลา?',
      text: `ต้องการยกเลิกข้อมูลการลาของ ${item.name} ในวันที่เลือกใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันยกเลิก',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#EF5350'
    });

    if (res.isConfirmed) {
      try {
        await cancelAttendanceItem(item.leaveRecordId, item.userId, 'LEAVE');
        Swal.fire('สำเร็จ', 'ยกเลิกการลาเรียบร้อยแล้ว', 'success');
        fetchDaily(selectedDate);
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  const handleCancelOfficial = async (item: AggregatedUserDay) => {
    if (!item.officialRecordId) return;

    const res = await Swal.fire({
      title: 'ยกเลิกไปราชการ?',
      text: `ต้องการยกเลิกข้อมูลการไปราชการของ ${item.name} ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันยกเลิก',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#4A2C6D'
    });

    if (res.isConfirmed) {
      try {
        await cancelAttendanceItem(item.officialRecordId, item.userId, 'OFFICIAL');
        Swal.fire('สำเร็จ', 'ยกเลิกข้อมูลไปราชการเรียบร้อยแล้ว', 'success');
        fetchDaily(selectedDate);
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  const printReport = (title: string, tableId: string) => {
    const tableElem = document.getElementById(tableId);
    if (!tableElem) return;

    const win = window.open('', '_blank');
    if (!win) {
      // Direct window.print if popup blocked
      window.print();
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { font-family: 'Sarabun', sans-serif; box-sizing: border-box; color: #000000 !important; }
          body { padding: 4mm 6mm !important; margin: 0 !important; color: #000000 !important; background: #ffffff !important; }
          h2 { text-align: center; margin-bottom: 4px; color: #000000 !important; font-size: 17px; font-weight: bold; }
          p { text-align: center; margin-top: 0; color: #000000 !important; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; border: 1px solid #000000 !important; }
          th, td { border: 1px solid #000000 !important; padding: 5px 6px; color: #000000 !important; }
          th { background: #f2f2f2 !important; color: #000000 !important; font-weight: bold; text-align: center; }
          td { text-align: center; color: #000000 !important; }
          td:nth-child(2), td:nth-child(3) { text-align: left; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 5mm 6mm !important; }
        </style>
      </head>
      <body>
        <h2>${config.orgName}</h2>
        <p>${config.systemName || 'ระบบลงเวลาปฏิบัติงานออนไลน์'} | ${title} (ประจำวันที่ ${selectedDate})</p>
        ${tableElem.outerHTML}
        <div style="margin-top: 20px; text-align: right; font-size: 10px; color: #000000;">
          พิมพ์จากระบบเมื่อ: ${getInternetClockParts().thaiDate} เวลา ${getInternetTimeString()} น. (เวลามาตรฐานอินเทอร์เน็ต)
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* VIEW: DAILY DASHBOARD */}
      {activeView === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Top Bar with Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#7C3AED]" /> ภาพรวมการลงเวลารายวัน
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                ข้อมูลบันทึกเวลาประจำวันที่ {selectedDate}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {onOpenHolidaysModal && (
                <button
                  type="button"
                  onClick={onOpenHolidaysModal}
                  className="px-3 py-1.5 sm:py-2 bg-purple-50 hover:bg-purple-100 text-[#7C3AED] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-purple-200 shadow-2xs"
                  title="กำหนดวันหยุดและวันทำการประจำเดือน"
                >
                  <Calendar className="w-4 h-4 text-[#7C3AED]" />
                  <span>กำหนดวันหยุด</span>
                </button>
              )}
              {onOpenDeleteDataModal && (
                <button
                  type="button"
                  onClick={onOpenDeleteDataModal}
                  className="px-3 py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200 shadow-2xs"
                  title="จัดการลบข้อมูลการลงเวลา / ประวัติระบบ"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>ลบข้อมูล</span>
                </button>
              )}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6] bg-slate-50"
              />
              <button
                onClick={() => fetchDaily(selectedDate)}
                className="p-2 sm:p-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-colors cursor-pointer shrink-0"
                title="รีเฟรชข้อมูล"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stat Cards Grid with Pastel Accents */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm sm:shadow-md flex items-center gap-2.5 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-mono truncate">{totalOut}</div>
                <div className="text-[11px] sm:text-xs text-amber-100 font-medium truncate">ลงเวลากลับแล้ว (คน)</div>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm sm:shadow-md flex items-center gap-2.5 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-mono truncate">{totalEarly}</div>
                <div className="text-[11px] sm:text-xs text-rose-100 font-medium truncate">กลับก่อนเวลา (คน)</div>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm sm:shadow-md flex items-center gap-2.5 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <CalendarOff className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-mono truncate">{totalLeave}</div>
                <div className="text-[11px] sm:text-xs text-sky-100 font-medium truncate">ลาหยุด (คน)</div>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-700 text-white shadow-sm sm:shadow-md flex items-center gap-2.5 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-mono truncate">{totalOfficial}</div>
                <div className="text-[11px] sm:text-xs text-purple-100 font-medium truncate">ไปราชการ (คน)</div>
              </div>
            </div>
          </div>

          {/* Analytics Donut / Radar Chart */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left w-full md:w-auto">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#7C3AED]" /> สัดส่วนการลงเวลาประจำวัน
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                เปรียบเทียบสถิติการกลับปกติ กลับก่อนเวลา การลา และการไปราชการ
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] sm:text-xs">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#10B981] shrink-0" /> กลับปกติ: {Math.max(0, totalOut - totalEarly)}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#F57C00] shrink-0" /> กลับก่อน: {totalEarly}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#0288D1] shrink-0" /> ลาหยุด: {totalLeave}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#8B5CF6] shrink-0" /> ไปราชการ: {totalOfficial}
                </div>
              </div>
            </div>

            <div className="w-56 sm:w-64 h-40 sm:h-48 flex items-center justify-center relative shrink-0">
              <canvas ref={radarCanvasRef} className="w-full h-full" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ส่วนสรุปรายงาน 'กลับก่อนเวลา' ของแต่ละคนแบบตารางสรุปรายวัน                      */}
          {/* ========================================================================= */}
          {(() => {
            const irregularList = dailyList.filter((u) => u.isEarly);

            return (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-rose-200/80 shadow-md overflow-hidden">
                <div className="p-3.5 sm:p-5 bg-gradient-to-r from-rose-50 via-amber-50 to-purple-50 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] sm:text-[11px] font-bold mb-1 border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" /> ตรวจสอบการลงเวลากลับก่อนเวลา
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                      สรุปรายงานผู้ลงเวลากลับก่อนเวลารายวัน
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      เกณฑ์เวลา: กลับก่อนเวลาก่อน <span className="font-mono font-bold text-amber-600">{config.earlyTime || '16:30'} น.</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 shadow-2xs">
                      พบ {irregularList.length} รายการ
                    </span>
                    {irregularList.length > 0 && (
                      <button
                        onClick={() => printReport('รายงานผู้กลับก่อนเวลาประจำวัน', 'irregularAttendanceTable')}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> พิมพ์สรุป (A4)
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-5">
                  {irregularList.length === 0 ? (
                    <div className="py-6 sm:py-8 px-4 text-center bg-emerald-50/70 rounded-xl sm:rounded-2xl border border-emerald-200/80">
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 mx-auto mb-2" />
                      <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                        ยอดเยี่ยม! วันที่ {selectedDate} ไม่มีผู้ลงเวลากลับก่อนเวลา
                      </h4>
                      <p className="text-[11px] sm:text-xs text-emerald-700 mt-1">
                        ครูและบุคลากรทุกคนลงเวลาปฏิบัติงานถูกต้องตามเกณฑ์เวลาของโรงเรียน
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-rose-100 shadow-2xs">
                      <table id="irregularAttendanceTable" className="w-full text-xs text-left text-slate-700 min-w-[500px]">
                        <thead className="bg-rose-50/60 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-rose-100">
                          <tr>
                            <th className="px-4 py-3 text-center">ลำดับ</th>
                            <th className="px-4 py-3">ครู / บุคลากร</th>
                            <th className="px-4 py-3">เวลากลับ (OUT)</th>
                            <th className="px-4 py-3 text-center">สถานะ</th>
                            <th className="px-4 py-3">ระยะห่าง / พิกัด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {irregularList.map((item, idx) => {
                            return (
                              <tr key={item.userId} className="hover:bg-rose-50/30 transition-colors">
                                <td className="px-4 py-3 text-center font-bold text-slate-400 font-mono">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                </td>
                                <td className="px-4 py-3 font-mono">
                                  {item.timeOut !== '-' ? (
                                    <span className="px-2.5 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 font-extrabold">
                                      <span>{item.timeOut} น.</span>
                                      <span className="text-[10px] text-amber-900 font-bold">(กลับก่อน)</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold text-[10px] shadow-2xs">
                                    กลับก่อนเวลา (ก่อน {config.earlyTime} น.)
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-[11px]">
                                  {item.distance !== undefined ? (
                                    <div className="flex items-center gap-1 text-slate-600">
                                      <span>ห่างจุด ร.ร. <b>{item.distance}</b> ม.</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Daily Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-5 border-b border-purple-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7C3AED]" /> รายชื่อครูผู้ลงเวลาประจำวัน (ทั้งหมด)
              </h3>
              <button
                onClick={() => printReport('รายงานการลงเวลาประจำวัน', 'dailyAttendanceTable')}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold hover:bg-purple-50 hover:text-[#7C3AED] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> พิมพ์รายงาน (A4)
              </button>
            </div>

            <div className="overflow-x-auto p-1.5 sm:p-2">
              <table id="dailyAttendanceTable" className="w-full text-xs text-left text-slate-700 min-w-[550px]">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-center">ลำดับ</th>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">เวลากลับ (OUT)</th>
                    <th className="px-4 py-3">ลา / ราชการ / หมายเหตุ</th>
                    <th className="px-4 py-3 text-center no-print">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        ไม่พบข้อมูลการลงเวลาในวันที่เลือก
                      </td>
                    </tr>
                  ) : (
                    dailyList.map((item, idx) => (
                      <tr key={item.userId} className="hover:bg-purple-50/30 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {item.timeOut !== '-' ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                                item.isEarly
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {item.timeOut} น. {item.isEarly ? '(ก่อนเวลา)' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.leaveNote !== '-' ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-medium border border-sky-200 inline-flex items-center gap-1">
                              {item.leaveNote}
                            </span>
                          ) : item.officialNote !== '-' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium border border-purple-200 inline-flex items-center gap-1">
                              {item.officialNote}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center no-print">
                          {item.leaveRecordId ? (
                            <button
                              onClick={() => handleCancelLeave(item)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> ยกเลิกลา
                            </button>
                          ) : item.officialRecordId ? (
                            <button
                              onClick={() => handleCancelOfficial(item)}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> ยกเลิกราชการ
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MONTHLY SUMMARY */}
      {activeView === 'summary' && subView === 'list' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#7C3AED]" /> สรุปการลงเวลารายบุคคลประจำเดือน
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">ยอดรวมมาปฏิบัติงาน สาย ลา และไปราชการ</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6] bg-slate-50"
              />
              <button
                onClick={() => fetchMonth(selectedMonth)}
                className="p-2 sm:p-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-colors cursor-pointer shrink-0"
                title="รีเฟรชข้อมูล"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-5 border-b border-purple-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">
                ตารางสรุปยอดเดือน {selectedMonth}
              </h3>
              <button
                onClick={() => printReport(`สรุปการลงเวลารายเดือน ${selectedMonth}`, 'monthlySummaryTable')}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold hover:bg-purple-50 hover:text-[#7C3AED] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> พิมพ์สรุป (A4)
              </button>
            </div>

            <div className="overflow-x-auto p-1.5 sm:p-2">
              <table id="monthlySummaryTable" className="w-full text-xs text-left text-slate-700 min-w-[650px]">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-center">ลำดับ</th>
                    <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 text-center bg-amber-50 text-amber-800">กลับปกติ (วัน)</th>
                    <th className="px-4 py-3 text-center bg-orange-50 text-orange-700">กลับก่อน (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-sky-50 text-sky-800">ลาหยุด (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-purple-50 text-purple-800">ไปราชการ (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-emerald-50 text-emerald-800">รวมลงเวลากลับ (วัน)</th>
                    <th className="px-4 py-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        ไม่พบข้อมูลในเดือนที่เลือก
                      </td>
                    </tr>
                  ) : (
                    monthList.map((m, idx) => (
                      <tr key={m.userId} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-amber-700 bg-amber-50/40">
                          {Math.max(0, m.countOut - m.countEarly)}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600 bg-orange-50/40">
                          {m.countEarly}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-sky-700 bg-sky-50/40">
                          {m.countLeave}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-purple-700 bg-purple-50/40">
                          {m.countOfficial}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                          {m.countOut}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={async () => {
                              const found = allUserAccounts.find(u => u.id === m.userId || u.username === m.userId);
                              if (found) {
                                setSelectedUser(found);
                                setSubView('individual-report');
                              } else {
                                Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลบัญชีครู', 'error');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-50 text-[#7C3AED] hover:bg-purple-100 text-[10px] font-bold cursor-pointer"
                          >
                            ดูรายงาน
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === 'summary' && subView === 'individual-report' && selectedUser && (
        <div className="space-y-4">
          <button 
            onClick={() => setSubView('list')}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer"
          >
            ← กลับไปตารางสรุปรายเดือน
          </button>
          <TeacherReport user={selectedUser} config={config} />
        </div>
      )}

      {/* VIEW: SATELLITE MAP */}
      {activeView === 'map' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#7C3AED]" /> แผนที่ดาวเทียมจุดลงเวลา (Satellite)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                แสดงหมุดพิกัดจริงของบุคลากรที่สแกนลงเวลาในวันที่ {selectedDate}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#8B5CF6] bg-slate-50"
              />
            </div>
          </div>

          {/* Map Viewer Container */}
          <div className="bg-white p-2 rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm overflow-hidden h-[300px] sm:h-[420px] md:h-[480px] relative">
            <div ref={mapContainerRef} className="w-full h-full rounded-xl sm:rounded-2xl z-0" />
          </div>

          {/* Pins List Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm overflow-hidden p-3.5 sm:p-5">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#7C3AED]" /> รายการพิกัดตำแหน่งบุคลากรวันนี้
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700 min-w-[580px]">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">เวลาที่สแกน (OUT)</th>
                    <th className="px-4 py-3">พิกัดดาวเทียม (Lat, Lng)</th>
                    <th className="px-4 py-3">ระยะห่างจากโรงเรียน</th>
                    <th className="px-4 py-3 text-right">เลื่อนไปยังจุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyList.filter((u) => u.lat && u.lng).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        ยังไม่มีข้อมูลพิกัดลงเวลาในวันนี้
                      </td>
                    </tr>
                  ) : (
                    dailyList
                      .filter((u) => u.lat && u.lng)
                      .map((item) => (
                        <tr key={item.userId} className="hover:bg-purple-50/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                            <div className="text-[11px] text-slate-400">@{item.userId}</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-purple-800">
                            {item.timeOut !== '-' ? `${item.timeOut} น.` : `${item.timeIn} น.`}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {item.lat?.toFixed(6)}, {item.lng?.toFixed(6)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 font-bold text-[10px] border border-purple-200">
                              {item.distance || 0} เมตร
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                if (mapInstanceRef.current && item.lat && item.lng) {
                                  mapInstanceRef.current.setView([item.lat, item.lng], 19);
                                  window.scrollTo({
                                    top: mapContainerRef.current?.offsetTop
                                      ? mapContainerRef.current.offsetTop - 30
                                      : 0,
                                    behavior: 'smooth'
                                  });
                                }
                              }}
                              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-purple-50 text-[#7C3AED] hover:bg-purple-100 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Crosshair className="w-3.5 h-3.5" /> ซูมดูในแผนที่
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
