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
  cancelAttendanceItem
} from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface AdminReportsProps {
  config: SchoolConfig;
  currentUser: UserAccount;
  todaySummary: { in: string; out: string; leave: string; official: string };
  onTriggerClock: (action: 'IN' | 'OUT') => void;
  onLeaveRequest: () => void;
  onOfficialDutyRequest: () => void;
  onGoToPersonalAttendance: () => void;
  activeView: 'dashboard' | 'summary' | 'map' | 'logs';
  selectedDate: string;
  onDateChange: (d: string) => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({
  config,
  currentUser,
  todaySummary,
  onTriggerClock,
  onLeaveRequest,
  onOfficialDutyRequest,
  onGoToPersonalAttendance,
  activeView,
  selectedDate,
  onDateChange,
  selectedMonth,
  onMonthChange
}) => {
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; img?: string }[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);

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

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await getSystemLogsList();
      setSystemLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const users = await getAllUsersList();
      setAllUsers(users.map((u) => ({ id: u.username, name: u.fullname, img: u.img })));
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
    } else if (activeView === 'logs') {
      fetchLogs();
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
    } else if (r.action === 'LEAVE') {
      userDayMap[r.userId].leaveNote = r.note || 'ลา';
      userDayMap[r.userId].leaveRecordId = r.id;
    } else if (r.action === 'OFFICIAL') {
      userDayMap[r.userId].officialNote = r.note || 'ไปราชการ';
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

        // School Center circle
        L.circle([centerLat, centerLng], {
          color: '#0C7C82',
          fillColor: '#35B4B0',
          fillOpacity: 0.2,
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
              `https://ui-avatars.com/api/?name=${encodeURIComponent(log.name)}&background=0C7C82&color=fff`;

            const iconHtml = `
              <div style="width: 44px; height: 44px; position: relative;">
                <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid #0C7C82; box-shadow: 0 4px 10px rgba(0,0,0,0.3); background: #fff;">
                  <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #0C7C82;"></div>
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
                <img src="${avatarUrl}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; margin: 0 auto 6px; border: 2px solid #35B4B0;" />
                <div style="font-weight: bold; color: #0C7C82; font-size: 14px;">${log.name}</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">@${log.userId}</div>
                <div style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: #E0F2F1; color: #00796B; font-weight: bold; font-size: 11px;">
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

  // Draw Performance Radar / Doughnut on canvas
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
        { label: 'มาตรงเวลา', value: Math.max(0, totalIn - totalLate), color: '#26A69A' },
        { label: 'เข้าสาย', value: totalLate, color: '#EF5350' },
        { label: 'กลับตรงเวลา', value: Math.max(0, totalOut - totalEarly), color: '#35B4B0' },
        { label: 'กลับก่อน', value: totalEarly, color: '#F57C00' },
        { label: 'ลาหยุด', value: totalLeave, color: '#0288D1' },
        { label: 'ไปราชการ', value: totalOfficial, color: '#4A2C6D' }
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
      ctx.fillStyle = '#0C7C82';
      ctx.font = 'bold 22px Sarabun';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${totalIn}`, centerX, centerY - 8);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Sarabun';
      ctx.fillText('คนเข้างาน', centerX, centerY + 14);
    }
  }, [activeView, totalIn, totalLate, totalOut, totalEarly, totalLeave, totalOfficial]);

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
      Swal.fire('แจ้งเตือน', 'กรุณาอนุญาตให้แสดง Pop-up หน้าต่างเพื่อพิมพ์เอกสาร', 'warning');
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
          * { font-family: 'Sarabun', sans-serif; box-sizing: border-box; }
          body { padding: 15mm; color: #1e293b; }
          h2 { text-align: center; margin-bottom: 4px; color: #0C7C82; }
          p { text-align: center; margin-top: 0; color: #64748b; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          th { background: #E0F2F1; color: #00796B; font-weight: bold; text-align: center; }
          td { text-align: center; }
          td:nth-child(2), td:nth-child(3) { text-align: left; }
          .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; }
          @page { size: A4 portrait; margin: 10mm; }
        </style>
      </head>
      <body>
        <h2>${config.orgName}</h2>
        <p>${config.orgAffiliation} | ${title}</p>
        ${tableElem.outerHTML}
        <div style="margin-top: 30px; text-align: right; font-size: 12px; color: #64748b;">
          พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH')}
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
      {/* Admin Personal Attendance Banner (ลงเวลาปฏิบัติงานสำหรับผู้ดูแลระบบ) */}
      <div className="bg-gradient-to-r from-teal-900 via-[#0C7C82] to-[#26A69A] p-5 sm:p-6 rounded-3xl text-white shadow-xl shadow-teal-950/20 border border-teal-500/30 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative shrink-0">
            <img
              src={
                currentUser.img ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  currentUser.fullname
                )}&background=0C7C82&color=fff`
              }
              alt="Profile"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white/50 shadow-md bg-white"
            />
            <span
              className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full shadow"
              title="ผู้ดูแลระบบ"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-teal-100 text-[10px] font-bold">
                ลงเวลาปฏิบัติงานของผู้ดูแลระบบ
              </span>
              <button
                onClick={onGoToPersonalAttendance}
                className="text-[11px] text-teal-200 hover:text-white underline cursor-pointer font-medium"
              >
                ดูหน้าลงเวลาแบบเต็ม
              </button>
            </div>
            <h3 className="text-base sm:text-lg font-bold leading-tight mt-1">{currentUser.fullname}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-teal-100 mt-1">
              <span className="font-mono bg-black/20 px-2.5 py-0.5 rounded-lg border border-white/10">
                มา: <b className="text-white">{todaySummary.in}</b> | กลับ: <b className="text-white">{todaySummary.out}</b>
              </span>
              {todaySummary.leave && (
                <span className="bg-sky-500/40 text-sky-100 px-2 py-0.5 rounded-lg font-medium">
                  ลา: {todaySummary.leave.split(' ')[0]}
                </span>
              )}
              {todaySummary.official && (
                <span className="bg-purple-500/40 text-purple-100 px-2 py-0.5 rounded-lg font-medium">
                  ไปราชการ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4 Clock Action Buttons for Admin */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => onTriggerClock('IN')}
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
          >
            <Clock className="w-4 h-4" />
            <span>สแกนเข้า ({todaySummary.in})</span>
          </button>

          <button
            onClick={() => onTriggerClock('OUT')}
            className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
          >
            <LogOut className="w-4 h-4" />
            <span>สแกนกลับ ({todaySummary.out})</span>
          </button>

          <button
            onClick={onLeaveRequest}
            className="px-3.5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
          >
            <CalendarOff className="w-4 h-4" />
            <span>แจ้งลาหยุด</span>
          </button>

          <button
            onClick={onOfficialDutyRequest}
            className="px-3.5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
          >
            <Briefcase className="w-4 h-4" />
            <span>ไปราชการ</span>
          </button>
        </div>
      </div>

      {/* VIEW: DAILY DASHBOARD */}
      {activeView === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Bar with Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0C7C82]" /> ภาพรวมการลงเวลารายวัน
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ข้อมูลบันทึกเวลาประจำวันที่ {selectedDate}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#35B4B0] bg-slate-50"
              />
              <button
                onClick={() => fetchDaily(selectedDate)}
                className="p-2.5 rounded-xl bg-[#0C7C82] hover:bg-[#075257] text-white transition-colors cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono">{totalIn}</div>
                <div className="text-xs text-teal-100 font-medium">มาแล้ว (คน)</div>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono">{totalLate}</div>
                <div className="text-xs text-rose-100 font-medium">เข้าสาย (คน)</div>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-md flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono">{totalOut}</div>
                <div className="text-xs text-amber-100 font-medium">กลับแล้ว (คน)</div>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-md flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <CalendarOff className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono">{totalLeave + totalOfficial}</div>
                <div className="text-xs text-sky-100 font-medium">ลา / ราชการ (คน)</div>
              </div>
            </div>
          </div>

          {/* Analytics Donut / Radar Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-base font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                <PieChartIcon className="w-5 h-5 text-[#0C7C82]" /> สัดส่วนการลงเวลาประจำวัน
              </h3>
              <p className="text-xs text-slate-500">
                เปรียบเทียบสถิติการมาตรงเวลา เข้าสาย การลา และการไปราชการ
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#26A69A]" /> มาตรงเวลา: {Math.max(0, totalIn - totalLate)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#EF5350]" /> เข้าสาย: {totalLate}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#35B4B0]" /> กลับตรงเวลา: {Math.max(0, totalOut - totalEarly)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F57C00]" /> กลับก่อน: {totalEarly}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#0288D1]" /> ลาหยุด: {totalLeave}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#4A2C6D]" /> ไปราชการ: {totalOfficial}
                </div>
              </div>
            </div>

            <div className="w-64 h-48 flex items-center justify-center relative">
              <canvas ref={radarCanvasRef} className="w-full h-full" />
            </div>
          </div>

          {/* Daily Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0C7C82]" /> รายชื่อครูผู้ลงเวลาประจำวัน
              </h3>
              <button
                onClick={() => printReport('รายงานการลงเวลาประจำวัน', 'dailyAttendanceTable')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> พิมพ์รายงาน (A4)
              </button>
            </div>

            <div className="overflow-x-auto p-2">
              <table id="dailyAttendanceTable" className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-center">ลำดับ</th>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">เวลามา (IN)</th>
                    <th className="px-4 py-3">เวลากลับ (OUT)</th>
                    <th className="px-4 py-3">ลา / ราชการ / หมายเหตุ</th>
                    <th className="px-4 py-3 text-center no-print">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        ไม่พบข้อมูลการลงเวลาในวันที่เลือก
                      </td>
                    </tr>
                  ) : (
                    dailyList.map((item, idx) => (
                      <tr key={item.userId} className="hover:bg-teal-50/30 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 flex items-center gap-2.5">
                          <img
                            src={
                              item.img ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                item.name
                              )}&background=0C7C82&color=fff`
                            }
                            alt={item.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                            <div className="text-[11px] text-slate-400">@{item.userId}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {item.timeIn !== '-' ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                                item.isLate
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <Clock className="w-3 h-3" /> {item.timeIn} น. {item.isLate ? '(สาย)' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {item.timeOut !== '-' ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                                item.isEarly
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-teal-100 text-teal-800 border border-teal-200'
                              }`}
                            >
                              <LogOut className="w-3 h-3" /> {item.timeOut} น. {item.isEarly ? '(ก่อนเวลา)' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.leaveNote !== '-' ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-medium border border-sky-200 inline-flex items-center gap-1">
                              <CalendarOff className="w-3 h-3" /> {item.leaveNote}
                            </span>
                          ) : item.officialNote !== '-' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium border border-purple-200 inline-flex items-center gap-1">
                              <Briefcase className="w-3 h-3" /> ไปราชการ: {item.officialNote}
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
      {activeView === 'summary' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0C7C82]" /> สรุปการลงเวลารายบุคคลประจำเดือน
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">ยอดรวมมาปฏิบัติงาน สาย ลา และไปราชการ</p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#35B4B0] bg-slate-50"
              />
              <button
                onClick={() => fetchMonth(selectedMonth)}
                className="p-2.5 rounded-xl bg-[#0C7C82] hover:bg-[#075257] text-white transition-colors cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                ตารางสรุปยอดเดือน {selectedMonth}
              </h3>
              <button
                onClick={() => printReport(`สรุปการลงเวลารายเดือน ${selectedMonth}`, 'monthlySummaryTable')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> พิมพ์สรุป (A4)
              </button>
            </div>

            <div className="overflow-x-auto p-2">
              <table id="monthlySummaryTable" className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-center">ลำดับ</th>
                    <th className="px-4 py-3">รหัส</th>
                    <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 text-center bg-teal-50 text-teal-800">มาทำงาน (วัน)</th>
                    <th className="px-4 py-3 text-center bg-rose-50 text-rose-700">มาสาย (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-amber-50 text-amber-700">กลับปกติ (วัน)</th>
                    <th className="px-4 py-3 text-center bg-orange-50 text-orange-700">กลับก่อน (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-sky-50 text-sky-800">ลาหยุด (ครั้ง)</th>
                    <th className="px-4 py-3 text-center bg-purple-50 text-purple-800">ไปราชการ (ครั้ง)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        ไม่พบข้อมูลในเดือนที่เลือก
                      </td>
                    </tr>
                  ) : (
                    monthList.map((m, idx) => (
                      <tr key={m.userId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-700">{m.userId}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-teal-700 bg-teal-50/40">
                          {m.countIn}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600 bg-rose-50/40">
                          {m.countLate}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-amber-700 bg-amber-50/40">
                          {m.countOut}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SATELLITE MAP */}
      {activeView === 'map' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#0C7C82]" /> แผนที่ดาวเทียมจุดลงเวลา (Satellite)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                แสดงหมุดพิกัดจริงของบุคลากรที่สแกนลงเวลาในวันที่ {selectedDate}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#35B4B0] bg-slate-50"
              />
            </div>
          </div>

          {/* Map Viewer Container */}
          <div className="bg-white p-2 rounded-3xl border border-slate-100 shadow-sm overflow-hidden h-[450px] relative">
            <div ref={mapContainerRef} className="w-full h-full rounded-2xl z-0" />
          </div>

          {/* Pins List Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-5">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#0C7C82]" /> รายการพิกัดตำแหน่งบุคลากรวันนี้
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">เวลาที่สแกน (IN)</th>
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
                        <tr key={item.userId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2.5">
                            <img
                              src={
                                item.img ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  item.name
                                )}&background=0C7C82&color=fff`
                              }
                              alt={item.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                              <div className="text-[11px] text-slate-400">@{item.userId}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-teal-800">
                            {item.timeIn} น.
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {item.lat?.toFixed(6)}, {item.lng?.toFixed(6)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 font-bold text-[10px] border border-teal-200">
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
                              className="px-3 py-1.5 rounded-xl bg-teal-50 text-[#0C7C82] hover:bg-teal-100 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
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

      {/* VIEW: SYSTEM LOGS */}
      {activeView === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <FileClock className="w-5 h-5 text-[#0C7C82]" /> ประวัติระบบและความปลอดภัย (System Logs)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">บันทึกกิจกรรมย้อนหลัง 100 รายการล่าสุดในระบบ</p>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3.5 py-2 rounded-xl bg-[#0C7C82] hover:bg-[#075257] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" /> รีเฟรชประวัติ
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">วัน-เวลา</th>
                    <th className="px-4 py-3">ผู้ใช้งาน</th>
                    <th className="px-4 py-3">ประเภทกิจกรรม</th>
                    <th className="px-4 py-3">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400">
                        ยังไม่มีประวัติการบันทึก Log ในระบบ
                      </td>
                    </tr>
                  ) : (
                    systemLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.time}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {log.user}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.action === 'LOGIN'
                                ? 'bg-sky-100 text-sky-800'
                                : log.action === 'ATTENDANCE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'CONFIG'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.details}
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
