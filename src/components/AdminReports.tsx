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
  ShieldCheck,
  UserX,
  Sparkles,
  Plus,
  Check,
  Loader2,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  Edit3,
  UserCheck,
  ChevronRight
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
import { TeacherReport, formatTableLeaveDisplay, formatTableOfficialDisplay, formatThaiDateText } from './TeacherReport';
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
  onSelectTab?: (tab: string) => void;
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
  onOpenDeleteDataModal,
  onSelectTab
}) => {
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; img?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [subView, setSubView] = useState<'list' | 'individual-report'>('list');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [allUserAccounts, setAllUserAccounts] = useState<UserAccount[]>([]);

  // Manual Attendance State
  const [manualTeacherId, setManualTeacherId] = useState<string>('');
  const [manualAction, setManualAction] = useState<'IN' | 'OUT' | 'LEAVE' | 'OFFICIAL'>('OUT');
  const [manualTime, setManualTime] = useState<string>(() => getInternetTimeString());
  const [manualLeaveType, setManualLeaveType] = useState<string>('ลากิจส่วนตัว');
  const [manualLeaveReason, setManualLeaveReason] = useState<string>('');
  const [manualOfficialTopic, setManualOfficialTopic] = useState<string>('');
  const [manualReasonPreset, setManualReasonPreset] = useState<string>('โทรศัพท์มือถือขัดข้อง / แบตเตอรี่หมด');
  const [manualCustomRemark, setManualCustomRemark] = useState<string>('');
  const [manualSearchTerm, setManualSearchTerm] = useState<string>('');
  const [submittingManual, setSubmittingManual] = useState<boolean>(false);

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
    if (activeView === 'dashboard' || activeView === 'map' || activeView === 'manual-clock') {
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
    inRecordId?: string;
    timeOut: string;
    isEarly: boolean;
    outRecordId?: string;
    leaveNote: string;
    leaveRecordId?: string;
    officialNote: string;
    officialRecordId?: string;
    lat?: number;
    lng?: number;
    distance?: number;
    faceSnapshot?: string;
    img?: string;
    latestTime?: string;
  }

  // Set of inactive user identifiers (id & username) to completely exclude from all documents & reports in the system
  const inactiveUserIds = new Set(
    allUserAccounts
      .filter((u) => u.status === 'INACTIVE')
      .flatMap((u) => [u.id, u.username].filter(Boolean) as string[])
  );

  const teacherAccounts = allUserAccounts.filter(
    (u) => u.role !== 'admin' && u.status !== 'INACTIVE'
  );
  const userDayMap: { [uid: string]: AggregatedUserDay } = {};

  // 1. Seed userDayMap with all active teachers so everyone active appears in the daily report
  teacherAccounts.forEach((t) => {
    userDayMap[t.id] = {
      userId: t.id,
      name: t.fullname,
      timeIn: '-',
      isLate: false,
      timeOut: '-',
      isEarly: false,
      leaveNote: '-',
      officialNote: '-',
      img: t.img,
      latestTime: ''
    };
  });

  // 2. Overlay attendance records from dailyRecords
  dailyRecords.forEach((r) => {
    // Exclude records of inactive users from all documents & reports in the system
    if (inactiveUserIds.has(r.userId) || (r.employeeId && inactiveUserIds.has(r.employeeId))) {
      return;
    }

    const matched = teacherAccounts.find(
      (t) =>
        t.id === r.userId ||
        (t.username && t.username === r.userId) ||
        t.id === r.employeeId ||
        (t.username && t.username === r.employeeId)
    );
    const key = matched ? matched.id : r.userId;

    if (!userDayMap[key]) {
      const uInfo = allUsers.find((u) => u.id === r.userId);
      userDayMap[key] = {
        userId: r.userId,
        name: r.employeeName || uInfo?.name || r.userId,
        timeIn: '-',
        isLate: false,
        timeOut: '-',
        isEarly: false,
        leaveNote: '-',
        officialNote: '-',
        img: uInfo?.img || r.faceSnapshot,
        latestTime: ''
      };
    }

    if (r.time) {
      if (!userDayMap[key].latestTime || r.time > (userDayMap[key].latestTime || '')) {
        userDayMap[key].latestTime = r.time;
      }
    }

    if (r.action === 'IN') {
      userDayMap[key].timeIn = r.time;
      userDayMap[key].isLate = !!r.isLate;
      userDayMap[key].inRecordId = r.id;
      userDayMap[key].lat = r.lat;
      userDayMap[key].lng = r.lng;
      userDayMap[key].distance = r.distance;
      userDayMap[key].faceSnapshot = r.faceSnapshot;
    } else if (r.action === 'OUT') {
      userDayMap[key].timeOut = r.time;
      userDayMap[key].isEarly = !!r.isEarly;
      userDayMap[key].outRecordId = r.id;
      if (!userDayMap[key].lat && r.lat) {
        userDayMap[key].lat = r.lat;
        userDayMap[key].lng = r.lng;
        userDayMap[key].distance = r.distance;
      }
    } else if (r.action === 'LEAVE') {
      userDayMap[key].leaveNote = formatTableLeaveDisplay(r.note);
      userDayMap[key].leaveRecordId = r.id;
    } else if (r.action === 'OFFICIAL') {
      userDayMap[key].officialNote = formatTableOfficialDisplay(r.note);
      userDayMap[key].officialRecordId = r.id;
    }
  });

  // Sort dailyList: earliest attendance time first (ผู้ลงเวลาก่อนเป็นลำดับแรก)
  const getRecordSortTime = (u: AggregatedUserDay): string => {
    if (u.timeOut && u.timeOut !== '-') return u.timeOut;
    if (u.latestTime && u.latestTime !== '-') return u.latestTime;
    if (u.timeIn && u.timeIn !== '-') return u.timeIn;
    return '';
  };

  const dailyList = Object.values(userDayMap).sort((a, b) => {
    const timeA = getRecordSortTime(a);
    const timeB = getRecordSortTime(b);

    // Both have recorded attendance: earliest time first (ผู้ลงเวลาก่อนเป็นลำดับแรก เช่น "15:20" มาก่อน "16:45")
    if (timeA && timeB) {
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
    }
    // Person with recorded attendance comes before person without
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // Fallback: Thai alphabetical order
    return a.name.localeCompare(b.name, 'th');
  });

  // Stats calculation
  const totalIn = dailyList.filter((u) => u.timeIn !== '-').length;
  const totalLate = dailyList.filter((u) => u.isLate).length;
  const totalOut = dailyList.filter((u) => u.timeOut !== '-').length;
  const totalEarly = dailyList.filter((u) => u.isEarly).length;
  const totalLeave = dailyList.filter((u) => u.leaveNote !== '-').length;
  const totalOfficial = dailyList.filter((u) => u.officialNote !== '-').length;
  const totalNotOut = dailyList.filter(
    (u) => u.timeOut === '-' && u.leaveNote === '-' && u.officialNote === '-'
  ).length;

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
    firstDateTime?: string;
  }

  const monthSummaryMap: { [uid: string]: MonthSummaryItem } = {};

  // Seed monthSummaryMap with all active teachers so everyone appears in the monthly summary report
  teacherAccounts.forEach((t) => {
    monthSummaryMap[t.id] = {
      userId: t.id,
      name: t.fullname,
      countIn: 0,
      countLate: 0,
      countOut: 0,
      countEarly: 0,
      countLeave: 0,
      countOfficial: 0,
      firstDateTime: ''
    };
  });

  monthRecords.forEach((r) => {
    // Exclude records of inactive users from monthly report documents
    if (inactiveUserIds.has(r.userId) || (r.employeeId && inactiveUserIds.has(r.employeeId))) {
      return;
    }

    const matched = teacherAccounts.find(
      (t) =>
        t.id === r.userId ||
        (t.username && t.username === r.userId) ||
        t.id === r.employeeId ||
        (t.username && t.username === r.employeeId)
    );
    const key = matched ? matched.id : r.userId;

    if (!monthSummaryMap[key]) {
      const uInfo = allUsers.find((u) => u.id === r.userId);
      monthSummaryMap[key] = {
        userId: r.userId,
        name: r.employeeName || uInfo?.name || r.userId,
        countIn: 0,
        countLate: 0,
        countOut: 0,
        countEarly: 0,
        countLeave: 0,
        countOfficial: 0,
        firstDateTime: ''
      };
    }

    const dt = `${r.date || ''} ${r.time || ''}`;
    if (!monthSummaryMap[key].firstDateTime || dt < (monthSummaryMap[key].firstDateTime || '')) {
      monthSummaryMap[key].firstDateTime = dt;
    }

    if (r.action === 'IN') {
      monthSummaryMap[key].countIn += 1;
      if (r.isLate) monthSummaryMap[key].countLate += 1;
    } else if (r.action === 'OUT') {
      monthSummaryMap[key].countOut += 1;
      if (r.isEarly) monthSummaryMap[key].countEarly += 1;
    } else if (r.action === 'LEAVE') {
      monthSummaryMap[key].countLeave += 1;
    } else if (r.action === 'OFFICIAL') {
      monthSummaryMap[key].countOfficial += 1;
    }
  });

  const monthList = Object.values(monthSummaryMap).sort((a, b) => {
    const dtA = a.firstDateTime || '';
    const dtB = b.firstDateTime || '';
    if (dtA && dtB && dtA !== dtB) {
      return dtA.localeCompare(dtB);
    }
    if (dtA && !dtB) return -1;
    if (!dtA && dtB) return 1;
    return a.name.localeCompare(b.name, 'th');
  });

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
        { label: 'ไปราชการ', value: totalOfficial, color: '#8B5CF6' },
        { label: 'ไม่ลงเวลากลับ', value: totalNotOut, color: '#E11D48' }
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
  }, [activeView, totalOut, totalEarly, totalLeave, totalOfficial, totalNotOut]);

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

  const handleCancelAttendanceItem = async (recordId: string, userName: string, actionText: string) => {
    const res = await Swal.fire({
      title: `ยกเลิกการ${actionText}?`,
      text: `ต้องการยกเลิกข้อมูลการ${actionText}ของ ${userName} ในวันที่ ${formatThaiDateText(selectedDate)} ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันยกเลิก',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#EF5350'
    });

    if (res.isConfirmed) {
      try {
        await cancelAttendanceItem(recordId, userName, actionText);
        Swal.fire('สำเร็จ', `ยกเลิกการ${actionText}เรียบร้อยแล้ว`, 'success');
        fetchDaily(selectedDate);
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  const handleQuickClockForUser = (teacher: UserAccount, action: 'IN' | 'OUT') => {
    const defaultTime = action === 'IN' ? (config.lateTime || '07:45') : (config.earlyTime || '16:30');
    setManualTeacherId(teacher.id);
    setManualAction(action);
    setManualTime(getInternetTimeString() || defaultTime);
    if (activeView !== 'manual-clock') {
      onSelectTab?.('admin-manual-clock');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveManualAttendance = async () => {
    if (!manualTeacherId) {
      Swal.fire('กรุณาเลือกครู', 'โปรดเลือกครูหรือบุคลากรที่ต้องการลงเวลาให้', 'warning');
      return;
    }

    const teacher = teacherAccounts.find(
      (t) => t.id === manualTeacherId || (t.username && t.username === manualTeacherId)
    );
    if (!teacher) {
      Swal.fire('ไม่พบบุคลากร', 'ไม่พบบัญชีครูที่เลือกในระบบ', 'error');
      return;
    }

    if ((manualAction === 'IN' || manualAction === 'OUT') && !manualTime) {
      Swal.fire('กรุณาระบุเวลา', 'โปรดระบุเวลาที่ต้องการบันทึก', 'warning');
      return;
    }

    let actionLabel = '';
    if (manualAction === 'IN') {
      actionLabel = 'ลงเวลาเข้างาน (IN)';
    } else if (manualAction === 'OUT') {
      actionLabel = 'ลงเวลากลับ (OUT)';
    } else if (manualAction === 'LEAVE') {
      actionLabel = `แจ้งลาหยุด (${manualLeaveType})`;
    } else if (manualAction === 'OFFICIAL') {
      actionLabel = `ไปราชการ (${manualOfficialTopic || 'ปฏิบัติราชการนอกสถานที่'})`;
    }

    const reasonDetail =
      manualReasonPreset === 'อื่นๆ'
        ? (manualCustomRemark || 'ผู้ดูแลระบบลงเวลาแทน')
        : `${manualReasonPreset}${manualCustomRemark ? ` (${manualCustomRemark})` : ''}`;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันลงเวลาด้วยระบบ?',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; padding: 12px; background: #f5f3ff; border-radius: 12px; border: 1px solid #ddd6fe;">
          <div><b>ครู/บุคลากร:</b> ${teacher.fullname}</div>
          <div><b>วันที่:</b> ${formatThaiDateText(selectedDate)}</div>
          <div><b>ประเภท:</b> <span style="color: #6d28d9; font-weight: bold;">${actionLabel}</span></div>
          ${manualAction === 'IN' || manualAction === 'OUT' ? `<div><b>เวลา:</b> ${manualTime} น.</div>` : ''}
          <div><b>เหตุผลที่บันทึกแทน:</b> ${reasonDetail}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">* บันทึกโดย: ผู้ดูแลระบบ (${user.fullname || user.username})</div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันบันทึกเวลา',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10B981'
    });

    if (!confirmRes.isConfirmed) return;

    setSubmittingManual(true);
    try {
      const isLate =
        manualAction === 'IN' && config.lateTime && manualTime > config.lateTime;
      const isEarly =
        manualAction === 'OUT' &&
        config.earlyTime &&
        manualTime < config.earlyTime;

      let finalNote = '';
      if (manualAction === 'LEAVE') {
        finalNote = `${manualLeaveType}${manualLeaveReason ? ` - ${manualLeaveReason}` : ''} [ลงเวลาแทนโดย: ${user.fullname || user.username}]`;
      } else if (manualAction === 'OFFICIAL') {
        finalNote = `${manualOfficialTopic || 'ไปราชการ'} [ลงเวลาแทนโดย: ${user.fullname || user.username}]`;
      } else {
        finalNote = `ลงเวลาด้วยระบบ (${reasonDetail}) [ผู้บันทึก: ${user.fullname || user.username}]`;
      }

      const rec: Omit<AttendanceRecord, 'id'> = {
        userId: teacher.id,
        employeeId: teacher.username || teacher.id,
        employeeName: teacher.fullname,
        action: manualAction,
        date: selectedDate,
        dateThai: formatThaiDateText(selectedDate),
        time: manualAction === 'LEAVE' || manualAction === 'OFFICIAL' ? (manualTime || '08:30') : manualTime,
        isLate: !!isLate,
        isEarly: !!isEarly,
        note: finalNote,
        lat: config.centerLat,
        lng: config.centerLng,
        distance: 0,
        macAddress: 'ADMIN_MANUAL',
        timestamp: Date.now()
      };

      const result = await saveAttendanceRecord(rec);
      if (result.ok) {
        await Swal.fire('บันทึกสำเร็จ!', `ลงเวลาให้คุณ ${teacher.fullname} เรียบร้อยแล้ว`, 'success');
        await fetchDaily(selectedDate);
      } else {
        await Swal.fire('ผิดพลาด', result.message || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      }
    } catch (err: unknown) {
      console.error('Manual attendance error:', err);
      Swal.fire('เกิดข้อผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSubmittingManual(false);
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

    const isUnrecorded = tableId === 'unrecordedAttendanceTable';
    const isMonth = tableId === 'monthlySummaryTable';
    let dateSubtitle = '';
    if (isMonth) {
      const parts = selectedMonth.split('-');
      if (parts.length === 2) {
        const thaiMonths = [
          'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
          'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const mIdx = parseInt(parts[1], 10) - 1;
        const yThai = parseInt(parts[0], 10) + 543;
        dateSubtitle = `ประจำเดือน ${thaiMonths[mIdx] || ''} พ.ศ. ${yThai}`;
      } else {
        dateSubtitle = `ประจำเดือน ${selectedMonth}`;
      }
    } else {
      dateSubtitle = `ประจำวันที่ ${formatThaiDateText(selectedDate)}`;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            font-family: 'Sarabun', sans-serif;
            box-sizing: border-box;
            color: #000000 !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm !important;
          }
          body {
            padding: 0 !important;
            margin: 0 !important;
            color: #000000 !important;
            background: #ffffff !important;
            width: 100% !important;
          }
          h2 {
            text-align: center;
            margin: 0 0 4px 0;
            color: #000000 !important;
            font-size: 18px;
            font-weight: bold;
          }
          .report-title {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            margin: 4px 0 2px 0;
            color: #000000 !important;
          }
          .report-subtitle {
            text-align: center;
            font-size: 13px;
            margin: 0 0 12px 0;
            color: #000000 !important;
          }
          .summary-box {
            display: flex;
            justify-content: space-between;
            border: 1px solid #000000 !important;
            padding: 6px 12px;
            margin: 6px 0 12px 0;
            font-size: 11px;
            background: #fafafa !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin: 8px 0 16px 0 !important;
            border: 1px solid #000000 !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            border-collapse: collapse !important;
            padding: 6px 8px !important;
            color: #000000 !important;
            font-size: 11.5px !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          thead tr, tbody tr {
            border: none !important;
          }
          th {
            background-color: #f2f2f2 !important;
            color: #000000 !important;
            font-weight: bold !important;
            text-align: center !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td {
            color: #000000 !important;
          }
          span {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            font-size: inherit !important;
            padding: 0 !important;
            color: #000000 !important;
            font-weight: normal !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <h2>${config.orgName}</h2>
        <div class="report-title">${title}</div>
        <div class="report-subtitle">${dateSubtitle}</div>
        ${!isUnrecorded && tableId === 'dailyAttendanceTable' ? `
        <div class="summary-box">
          <span><b>ลงเวลากลับแล้ว:</b> ${totalOut} คน</span>
          <span><b>กลับก่อนเวลา:</b> ${totalEarly} คน</span>
          <span><b>ลาหยุด:</b> ${totalLeave} คน</span>
          <span><b>ไปราชการ:</b> ${totalOfficial} คน</span>
          <span><b>ไม่ลงเวลากลับ:</b> ${totalNotOut} คน</span>
          <span><b>ครูทั้งหมด:</b> ${dailyList.length} คน</span>
        </div>` : ''}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
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

            <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-pink-700 text-white shadow-sm sm:shadow-md flex items-center gap-2.5 sm:gap-4 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-mono truncate">{totalNotOut}</div>
                <div className="text-[11px] sm:text-xs text-rose-100 font-medium truncate">ผู้ไม่ลงเวลากลับ (คน)</div>
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
                เปรียบเทียบสถิติการกลับปกติ กลับก่อนเวลา การลา การไปราชการ และผู้ไม่ลงเวลากลับ
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] sm:text-xs">
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
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#E11D48] shrink-0" /> ไม่ลงเวลา: {totalNotOut}
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
                      <table id="irregularAttendanceTable" className="w-full text-xs text-left text-slate-700">
                        <thead className="bg-rose-50/60 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-rose-100">
                          <tr>
                            <th style={{ width: '8%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">ลำดับ</th>
                            <th style={{ width: '34%', textAlign: 'left', whiteSpace: 'nowrap' }} className="px-3 py-3 text-left whitespace-nowrap">ครู / บุคลากร</th>
                            <th style={{ width: '18%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">เวลากลับ (OUT)</th>
                            <th style={{ width: '20%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">สถานะ</th>
                            <th style={{ width: '20%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">ระยะห่าง / พิกัด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {irregularList.map((item, idx) => (
                            <tr key={item.userId} className="hover:bg-rose-50/30 transition-colors">
                              <td style={{ width: '8%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-center font-bold text-slate-500 font-mono whitespace-nowrap">
                                {idx + 1}
                              </td>
                              <td style={{ width: '34%', textAlign: 'left', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-left font-semibold text-slate-800 text-sm whitespace-nowrap">
                                {item.name}
                              </td>
                              <td style={{ width: '18%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-center font-mono whitespace-nowrap">
                                {item.timeOut !== '-' ? (
                                  <span className="px-2 py-0.5 rounded-lg font-bold text-xs inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300">
                                    {item.timeOut} น. (กลับก่อน)
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td style={{ width: '20%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-center whitespace-nowrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-xs">
                                  กลับก่อนเวลา
                                </span>
                              </td>
                              <td style={{ width: '20%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-center text-slate-600 text-xs whitespace-nowrap">
                                {item.distance !== undefined ? `ห่าง ร.ร. ${item.distance} ม.` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* ส่วนสรุปรายงาน 'ผู้ไม่ลงเวลากลับ' ประจำวัน                                  */}
          {/* ========================================================================= */}
          {(() => {
            const notOutList = dailyList.filter(
              (u) => u.timeOut === '-' && u.leaveNote === '-' && u.officialNote === '-'
            );

            return (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-red-200 shadow-md overflow-hidden">
                <div className="p-3.5 sm:p-5 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] sm:text-[11px] font-bold mb-1 border border-red-200">
                      <UserX className="w-3.5 h-3.5 text-red-600 shrink-0" /> ตรวจสอบผู้ไม่ลงเวลากลับ
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                      สรุปรายงานผู้ไม่ลงเวลากลับประจำวัน
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      ครูและบุคลากรที่ยังไม่มีการบันทึกเวลากลับ และไม่ได้แจ้งลาหรือไปราชการ
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white border border-red-200 text-red-700 shadow-2xs">
                      พบ {notOutList.length} คน
                    </span>
                    {notOutList.length > 0 && (
                      <button
                        onClick={() => printReport('รายงานผู้ไม่ลงเวลากลับประจำวัน', 'unrecordedAttendanceTable')}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> พิมพ์สรุป (A4)
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-5">
                  {notOutList.length === 0 ? (
                    <div className="py-6 sm:py-8 px-4 text-center bg-emerald-50/70 rounded-xl sm:rounded-2xl border border-emerald-200/80">
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 mx-auto mb-2" />
                      <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                        ยอดเยี่ยม! วันที่ {selectedDate} ครูและบุคลากรทุกคนลงเวลาครบถ้วน
                      </h4>
                      <p className="text-[11px] sm:text-xs text-emerald-700 mt-1">
                        ไม่มีครูหรือบุคลากรที่ไม่ลงเวลากลับในวันนี้
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-red-100 shadow-2xs">
                      <table id="unrecordedAttendanceTable" className="w-full text-xs text-left text-slate-700">
                        <thead className="bg-red-50/70 text-slate-700 font-bold text-xs border-b border-red-100">
                          <tr>
                            <th style={{ width: '12%', textAlign: 'center' }} className="px-4 py-3 text-center">ลำดับ</th>
                            <th style={{ width: '58%', textAlign: 'left' }} className="px-4 py-3 text-left">ครู / บุคลากร</th>
                            <th style={{ width: '30%', textAlign: 'center' }} className="px-4 py-3 text-center">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50">
                          {notOutList.map((item, idx) => (
                            <tr key={item.userId} className="hover:bg-red-50/30 transition-colors">
                              <td style={{ textAlign: 'center' }} className="px-4 py-3 text-center font-bold text-slate-500 font-mono">
                                {idx + 1}
                              </td>
                              <td style={{ textAlign: 'left' }} className="px-4 py-3 text-left font-semibold text-slate-800 text-sm">
                                {item.name}
                              </td>
                              <td style={{ textAlign: 'center' }} className="px-4 py-3 text-center">
                                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-xs border border-red-200 shadow-2xs">
                                  ไม่ลงเวลากลับ
                                </span>
                              </td>
                            </tr>
                          ))}
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
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#7C3AED]" /> รายชื่อครูผู้ลงเวลาประจำวัน (ทั้งหมด)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  แสดงรายชื่อครูทุกคน พร้อมสถานะการลงเวลากลับ ลา และไม่ลงเวลา
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectTab?.('admin-manual-clock')}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] sm:text-xs font-bold hover:bg-emerald-100 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-600" /> ลงเวลาด้วยระบบ (Manual)
                </button>
                <button
                  onClick={() => printReport('รายงานการลงเวลาประจำวัน', 'dailyAttendanceTable')}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-[11px] sm:text-xs font-semibold hover:bg-purple-50 hover:text-[#7C3AED] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" /> พิมพ์รายงาน (A4)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto p-1.5 sm:p-2">
              <table id="dailyAttendanceTable" className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th style={{ width: '8%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">ลำดับ</th>
                    <th style={{ width: '34%', textAlign: 'left', whiteSpace: 'nowrap' }} className="px-3 py-3 text-left whitespace-nowrap">ครู / บุคลากร</th>
                    <th style={{ width: '28%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">เวลากลับ (OUT)</th>
                    <th style={{ width: '30%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center whitespace-nowrap">ลา / ราชการ / หมายเหตุ</th>
                    <th style={{ width: '10%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-3 text-center no-print whitespace-nowrap">จัดการ</th>
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
                    dailyList.map((item, idx) => {
                      const isNotOut = item.timeOut === '-' && item.leaveNote === '-' && item.officialNote === '-';

                      return (
                        <tr key={item.userId} className="hover:bg-purple-50/30 transition-colors">
                          <td style={{ width: '8%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 text-center font-bold text-slate-400 whitespace-nowrap font-mono">{idx + 1}</td>
                          <td style={{ width: '34%', textAlign: 'left', whiteSpace: 'nowrap' }} className="px-3 py-2.5 whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-sm whitespace-nowrap">{item.name}</div>
                          </td>
                          <td style={{ width: '28%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 font-mono whitespace-nowrap">
                            {item.timeOut !== '-' ? (
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${
                                  item.isEarly
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                                }`}
                              >
                                {item.timeOut} น. {item.isEarly ? '(ก่อนเวลา)' : ''}
                              </span>
                            ) : isNotOut ? (
                              <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-red-50 text-red-600 border border-red-200 inline-flex items-center gap-1">
                                ไม่ลงเวลา
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td style={{ width: '30%', textAlign: 'center', whiteSpace: 'nowrap' }} className="px-3 py-2.5 whitespace-nowrap">
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
                          ) : item.outRecordId ? (
                            <button
                              onClick={() => handleCancelAttendanceItem(item.outRecordId!, item.name, 'เวลากลับ')}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                              title="ยกเลิกเวลากลับ"
                            >
                              <Trash2 className="w-3 h-3" /> ยกเลิก
                            </button>
                          ) : isNotOut ? (
                            <button
                              onClick={() => {
                                const teacher = teacherAccounts.find(
                                  (t) => t.id === item.userId || (t.username && t.username === item.userId)
                                );
                                if (teacher) {
                                  handleQuickClockForUser(teacher, 'OUT');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 border border-emerald-200"
                              title="ลงเวลากลับแทนครู"
                            >
                              <Clock className="w-3 h-3 text-emerald-600" /> ลงเวลาแทน
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })
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

      {/* VIEW: MANUAL CLOCK-IN / OUT (ลงเวลาด้วยระบบ โดยผู้ดูแลระบบ) */}
      {activeView === 'manual-clock' && (() => {
        const selectedTeacher = teacherAccounts.find(
          (t) => t.id === manualTeacherId || (t.username && t.username === manualTeacherId)
        );
        const selectedTeacherDay = selectedTeacher ? userDayMap[selectedTeacher.id] : null;

        const filteredTeacherAccounts = teacherAccounts.filter((t) => {
          if (!manualSearchTerm.trim()) return true;
          const query = manualSearchTerm.toLowerCase();
          return (
            t.fullname.toLowerCase().includes(query) ||
            (t.position && t.position.toLowerCase().includes(query)) ||
            (t.department && t.department.toLowerCase().includes(query)) ||
            (t.username && t.username.toLowerCase().includes(query))
          );
        });

        const isLateCheck =
          manualAction === 'IN' && config.lateTime && manualTime > config.lateTime;
        const isEarlyCheck =
          manualAction === 'OUT' &&
          config.earlyTime &&
          manualTime < config.earlyTime;

        const totalMarkedOut = teacherAccounts.filter(
          (t) => userDayMap[t.id]?.timeOut && userDayMap[t.id]?.timeOut !== '-'
        ).length;
        const totalPendingOut = teacherAccounts.length - totalMarkedOut;

        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-lg shadow-emerald-900/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-emerald-50 text-[11px] font-bold border border-white/25 mb-2 backdrop-blur-md">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ฟังก์ชันเฉพาะผู้ดูแลระบบ (Admin Manual Clock)</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5 text-white">
                  <Clock className="w-6 h-6 text-emerald-200" /> ลงเวลาด้วยระบบ
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-2xl leading-relaxed">
                  สำหรับผู้ดูแลระบบบันทึกเวลาแทนครูและบุคลากรรายบุคคล ในกรณีที่ครูไม่สามารถลงเวลาด้วยตนเองได้ (เช่น โทรศัพท์มือถือแบตเตอรี่หมด, อุปกรณ์ขัดข้อง, ลืมลงเวลา, หรือเหตุจำเป็นเร่งด่วน)
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 bg-white/10 p-3 rounded-2xl border border-white/20 backdrop-blur-md">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">วันที่ดำเนินการ</div>
                  <div className="text-xs text-white font-medium">{formatThaiDateText(selectedDate)}</div>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-mono font-bold border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer shadow-xs"
                />
              </div>
            </div>

            {/* Quick Stats Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-white p-3 sm:p-4 rounded-2xl border border-purple-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">ครูทั้งหมด</div>
                  <div className="text-base sm:text-lg font-black text-slate-800">{teacherAccounts.length} คน</div>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">ลงเวลากลับแล้ว</div>
                  <div className="text-base sm:text-lg font-black text-emerald-700">{totalMarkedOut} คน</div>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">ยังไม่ลงเวลากลับ</div>
                  <div className="text-base sm:text-lg font-black text-rose-600">{totalPendingOut} คน</div>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-4 rounded-2xl border border-sky-100 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <CalendarOff className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">ลา / ไปราชการ</div>
                  <div className="text-base sm:text-lg font-black text-sky-700">{totalLeave + totalOfficial} คน</div>
                </div>
              </div>
            </div>

            {/* Main Interactive Form Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
              {/* Left Column: Select Teacher Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" /> ขั้นตอนที่ 1: เลือกครู / บุคลากร
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      พร้อมใช้งาน {teacherAccounts.length} คน
                    </span>
                  </div>

                  {/* Teacher Dropdown Selector */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        ค้นหาและเลือกรายชื่อครู
                      </label>
                      <select
                        value={manualTeacherId}
                        onChange={(e) => setManualTeacherId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">-- กรุณาคลิกเลือกครู / บุคลากร --</option>
                        {teacherAccounts.map((t) => {
                          const dayStatus = userDayMap[t.id];
                          const hasOut = dayStatus && dayStatus.timeOut !== '-';
                          const hasIn = dayStatus && dayStatus.timeIn !== '-';
                          const statusTag = hasOut
                            ? `(กลับแล้ว ${dayStatus.timeOut} น.)`
                            : hasIn
                            ? `(เข้างานแล้ว ${dayStatus.timeIn} น.)`
                            : `(ยังไม่ลงเวลา)`;
                          return (
                            <option key={t.id} value={t.id}>
                              {t.fullname} - {t.position || 'ครู'} {statusTag}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Teacher Details Card (when selected) */}
                    {selectedTeacher ? (
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              selectedTeacher.img ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                selectedTeacher.fullname
                              )}&background=10B981&color=fff`
                            }
                            alt={selectedTeacher.fullname}
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-300 shadow-xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-slate-800 truncate">
                              {selectedTeacher.fullname}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {selectedTeacher.position || 'ครูผู้สอน'} • {selectedTeacher.department || 'กลุ่มสาระการเรียนรู้'}
                            </p>
                            <span className="text-[10px] text-emerald-800 font-mono font-bold">
                              @{selectedTeacher.username || selectedTeacher.id}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setManualTeacherId('')}
                            className="text-[11px] text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            ล้าง
                          </button>
                        </div>

                        {/* Today's status for this teacher */}
                        <div className="pt-2 border-t border-emerald-100 grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-xl bg-white border border-emerald-100">
                            <div className="text-[10px] text-slate-400 font-bold">เวลาเข้างาน (IN)</div>
                            <div className="text-xs font-mono font-black text-slate-700 mt-0.5">
                              {selectedTeacherDay?.timeIn !== '-' ? `${selectedTeacherDay?.timeIn} น.` : '-'}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-emerald-100">
                            <div className="text-[10px] text-slate-400 font-bold">เวลากลับ (OUT)</div>
                            <div className="text-xs font-mono font-black text-emerald-700 mt-0.5">
                              {selectedTeacherDay?.timeOut !== '-' ? `${selectedTeacherDay?.timeOut} น.` : 'ยังไม่ลงเวลา'}
                            </div>
                          </div>
                          {selectedTeacherDay?.leaveNote !== '-' && (
                            <div className="col-span-2 p-2 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 font-bold">
                              สถานะการลา: {selectedTeacherDay?.leaveNote}
                            </div>
                          )}
                          {selectedTeacherDay?.officialNote !== '-' && (
                            <div className="col-span-2 p-2 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-800 font-bold">
                              ไปราชการ: {selectedTeacherDay?.officialNote}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-emerald-600" />
                        <p className="text-xs font-medium">กรุณาเลือกครูหรือบุคลากรจากรายการด้านบน</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">หรือคลิกปุ่ม "ลงเวลาแทน" ในตารางด้านล่าง</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Attendance Action Details */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm p-4 sm:p-5 space-y-4">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-emerald-600" /> ขั้นตอนที่ 2: ระบุประเภทและเวลา
                  </h3>

                  {/* 1. Action Type Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">
                      ประเภทรายการ (Action)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setManualAction('OUT');
                          setManualTime(getInternetTimeString() || config.earlyTime || '16:30');
                        }}
                        className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          manualAction === 'OUT'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/25 scale-[1.02]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>ลงเวลากลับ (OUT)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setManualAction('IN');
                          setManualTime(getInternetTimeString() || config.lateTime || '07:45');
                        }}
                        className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          manualAction === 'IN'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/25 scale-[1.02]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>ลงเวลาเข้า (IN)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setManualAction('LEAVE')}
                        className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          manualAction === 'LEAVE'
                            ? 'bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/25 scale-[1.02]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700'
                        }`}
                      >
                        <CalendarOff className="w-4 h-4" />
                        <span>แจ้งลาหยุด</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setManualAction('OFFICIAL')}
                        className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          manualAction === 'OFFICIAL'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-600/25 scale-[1.02]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                        }`}
                      >
                        <Briefcase className="w-4 h-4" />
                        <span>ไปราชการ</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Time Input & Presets (for IN and OUT) */}
                  {(manualAction === 'IN' || manualAction === 'OUT') && (
                    <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" /> ระบุเวลาที่ต้องการบันทึก (HH:mm)
                        </label>
                        {/* Status preview */}
                        {isLateCheck ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            ⚠️ มาสาย (เกินเวลา {config.lateTime || '08:30'} น.)
                          </span>
                        ) : isEarlyCheck ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                            ⚠️ กลับก่อนเวลา (ก่อน {config.earlyTime || '16:30'} น.)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ เวลาปกติ
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="time"
                          value={manualTime}
                          onChange={(e) => setManualTime(e.target.value)}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-base font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setManualTime(getInternetTimeString())}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            เวลาปัจจุบัน
                          </button>
                          {manualAction === 'OUT' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setManualTime(config.earlyTime || '16:30')}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                {config.earlyTime || '16:30'} น. (ปกติ)
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualTime('16:00')}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                16:00 น.
                              </button>
                            </>
                          )}
                          {manualAction === 'IN' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setManualTime('07:45')}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                07:45 น. (เช้า)
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualTime('08:00')}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                08:00 น.
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Leave Fields (if LEAVE) */}
                  {manualAction === 'LEAVE' && (
                    <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-sky-900 mb-1">
                          ประเภทการลาหยุด
                        </label>
                        <select
                          value={manualLeaveType}
                          onChange={(e) => setManualLeaveType(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sky-300 text-xs font-bold text-sky-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                        >
                          <option value="ลากิจส่วนตัว">ลากิจส่วนตัว</option>
                          <option value="ลาป่วย">ลาป่วย</option>
                          <option value="ลาพักผ่อน">ลาพักผ่อน</option>
                          <option value="ลาคลอดบุตร">ลาคลอดบุตร</option>
                          <option value="ลาอุปสมบทหรือพิธีฮัจญ์">ลาอุปสมบทหรือพิธีฮัจญ์</option>
                          <option value="ลาเข้ารับการตรวจเลือกฯ">ลาเข้ารับการตรวจเลือกฯ</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-sky-900 mb-1">
                          เหตุผล / รายละเอียดการลา (ถ้ามี)
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น มีธุระส่วนตัวจำเป็น, มีใบรับรองแพทย์"
                          value={manualLeaveReason}
                          onChange={(e) => setManualLeaveReason(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-sky-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Official Duty Fields (if OFFICIAL) */}
                  {manualAction === 'OFFICIAL' && (
                    <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">
                          หัวข้อ / สถานที่ไปราชการ
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น เข้าร่วมการประชุมสัมมนา ณ สพป., อบรมเชิงปฏิบัติการ"
                          value={manualOfficialTopic}
                          onChange={(e) => setManualOfficialTopic(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* 5. Reason Preset for Manual Entry */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      สาเหตุหรือเหตุผลที่ผู้ดูแลระบบลงเวลาแทน (Audit Note)
                    </label>
                    <select
                      value={manualReasonPreset}
                      onChange={(e) => setManualReasonPreset(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-2 cursor-pointer"
                    >
                      <option value="โทรศัพท์มือถือขัดข้อง / แบตเตอรี่หมด">โทรศัพท์มือถือขัดข้อง / แบตเตอรี่หมด</option>
                      <option value="ระบบเครือข่ายสัญญาณหรือ GPS ขัดข้อง">ระบบเครือข่ายสัญญาณหรือ GPS ขัดข้อง</option>
                      <option value="ลืมลงเวลา (ครูมาปฏิบัติหน้าที่จริง)">ลืมลงเวลา (ครูมาปฏิบัติหน้าที่จริง)</option>
                      <option value="ปฏิบัติภารกิจเร่งด่วนตามคำสั่งผู้บริหาร">ปฏิบัติภารกิจเร่งด่วนตามคำสั่งผู้บริหาร</option>
                      <option value="อื่นๆ">อื่นๆ (ระบุหมายเหตุเอง)</option>
                    </select>

                    <input
                      type="text"
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                      value={manualCustomRemark}
                      onChange={(e) => setManualCustomRemark(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!manualTeacherId || submittingManual}
                      onClick={handleSaveManualAttendance}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-800/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submittingManual ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกเวลาแทนครู...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> ยืนยันบันทึกเวลาแทนครู (Save)
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1.5">
                      * ระบบจะบันทึกว่าเป็นการลงเวลาด้วยระบบโดยแอดมิน ({user.fullname || user.username}) และอัปเดตรายงานทันที
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Teacher List Table */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-100 shadow-sm overflow-hidden p-3.5 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" /> ตารางสถานะและลงเวลาด่วนในวันที่ {formatThaiDateText(selectedDate)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    คลิก "ลงเวลากลับ" เพื่อบันทึกเวลากลับด่วน หรือคลิก "เลือก" เพื่อเลือกครูไปจัดการด้านบน
                  </p>
                </div>
                {/* Search box */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อหรือตำแหน่ง..."
                    value={manualSearchTerm}
                    onChange={(e) => setManualSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 min-w-[650px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-3 text-center">ลำดับ</th>
                      <th className="px-3 py-3">ครู / บุคลากร</th>
                      <th className="px-3 py-3 text-center">เวลาเข้า (IN)</th>
                      <th className="px-3 py-3 text-center">เวลากลับ (OUT)</th>
                      <th className="px-3 py-3 text-center">ลา / ราชการ</th>
                      <th className="px-3 py-3 text-center">การจัดการด่วน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeacherAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          ไม่พบข้อมูลครูที่ค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredTeacherAccounts.map((t, idx) => {
                        const dayStatus = userDayMap[t.id];
                        const isNotOut = !dayStatus || (dayStatus.timeOut === '-' && dayStatus.leaveNote === '-' && dayStatus.officialNote === '-');

                        return (
                          <tr key={t.id} className="hover:bg-emerald-50/20 transition-colors">
                            <td className="px-3 py-2.5 text-center font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    t.img ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      t.fullname
                                    )}&background=10B981&color=fff`
                                  }
                                  alt={t.fullname}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 text-xs truncate">{t.fullname}</div>
                                  <div className="text-[10px] text-slate-400 truncate">{t.position || 'ครูผู้สอน'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              {dayStatus && dayStatus.timeIn !== '-' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                  {dayStatus.timeIn} น.
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">
                              {dayStatus && dayStatus.timeOut !== '-' ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                  {dayStatus.timeOut} น.
                                </span>
                              ) : isNotOut ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">
                                  ยังไม่ลงเวลา
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {dayStatus && dayStatus.leaveNote !== '-' ? (
                                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-medium border border-sky-200">
                                  {dayStatus.leaveNote}
                                </span>
                              ) : dayStatus && dayStatus.officialNote !== '-' ? (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-medium border border-purple-200">
                                  {dayStatus.officialNote}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isNotOut ? (
                                  <button
                                    onClick={() => handleQuickClockForUser(t, 'OUT')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                    title="ลงเวลากลับแทนทันที"
                                  >
                                    <Clock className="w-3 h-3" /> ลงเวลากลับ
                                  </button>
                                ) : dayStatus && dayStatus.outRecordId ? (
                                  <button
                                    onClick={() => handleCancelAttendanceItem(dayStatus.outRecordId!, t.fullname, 'เวลากลับ')}
                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    title="ยกเลิกเวลากลับ"
                                  >
                                    <Trash2 className="w-3 h-3" /> ยกเลิก
                                  </button>
                                ) : dayStatus && dayStatus.leaveRecordId ? (
                                  <button
                                    onClick={() => handleCancelLeave(dayStatus)}
                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" /> ยกเลิกลา
                                  </button>
                                ) : dayStatus && dayStatus.officialRecordId ? (
                                  <button
                                    onClick={() => handleCancelOfficial(dayStatus)}
                                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" /> ยกเลิก
                                  </button>
                                ) : null}

                                <button
                                  onClick={() => {
                                    setManualTeacherId(t.id);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                                >
                                  เลือก
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
