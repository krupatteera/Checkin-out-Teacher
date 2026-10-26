import React, { useEffect, useState } from 'react';
import {
  Clock,
  LogOut,
  FileText,
  CalendarOff,
  Briefcase,
  UserCheck,
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  School,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { SchoolConfig, UserAccount, AttendanceRecord } from '../types';
import { getUserRecentHistory } from '../firebase';
import { getInternetIsoDate } from '../utils/internetTime';
import { formatTableLeaveDisplay, formatTableOfficialDisplay } from './TeacherReport';

interface TeacherDashboardProps {
  user: UserAccount;
  config: SchoolConfig;
  onSelectTab: (tab: string) => void;
  onClockAction: (action: 'IN' | 'OUT') => void;
  onOpenLeaveModal: () => void;
  onOpenOfficialModal: () => void;
  onOpenEditProfile: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user,
  config,
  onSelectTab,
  onClockAction,
  onOpenLeaveModal,
  onOpenOfficialModal,
  onOpenEditProfile
}) => {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await getUserRecentHistory(user.id);
        setHistory(data);
      } catch (err) {
        console.error('Error fetching teacher history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user.id]);

  // Compute statistics from history (Clock-OUT, Leave, Official)
  const totalOut = history.filter(h => h.action === 'OUT').length;
  const totalNormalOut = history.filter(h => h.action === 'OUT' && !h.isEarly).length;
  const totalEarly = history.filter(h => h.action === 'OUT' && h.isEarly).length;
  const totalLeave = history.filter(h => h.action === 'LEAVE').length;
  const totalOfficial = history.filter(h => h.action === 'OFFICIAL').length;

  const todayStr = getInternetIsoDate();
  const todayRecords = history.filter(h => h.date === todayStr);
  const todayOut = todayRecords.find(h => h.action === 'OUT');
  const todayLeave = todayRecords.find(h => h.action === 'LEAVE');
  const todayOfficial = todayRecords.find(h => h.action === 'OFFICIAL');

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-xl shadow-purple-900/20">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={
                user.img ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.fullname
                )}&background=ffffff&color=7C3AED`
              }
              alt="Profile"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg bg-white"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold mb-1.5 text-purple-100 border border-white/20">
                <Sparkles className="w-3.5 h-3.5" /> แดชบอร์ดภาพรวมการปฏิบัติงาน
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                สวัสดี, {user.fullname}
              </h2>
              <p className="text-xs sm:text-sm text-purple-100 font-medium mt-0.5">
                {user.position || 'ครูผู้สอน'} • {config.orgName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onSelectTab('home')}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#7C3AED] hover:bg-purple-50 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4" /> ไปหน้าลงเวลา
            </button>
            <button
              onClick={() => onSelectTab('teacher-report')}
              className="px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs backdrop-blur-md border border-white/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" /> ดูรายงาน
            </button>
          </div>
        </div>
      </div>

      {/* Today Status Card: Clock Out */}
      <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${todayOut ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-bold uppercase">เวลากลับวันนี้ (OUT)</div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-800 font-mono mt-0.5">
              {todayOut ? `${todayOut.time} น.` : 'ยังไม่ลงเวลากลับ'}
            </div>
            {todayOut && (
              <div className="text-[11px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {todayOut.isEarly ? 'กลับก่อนเวลา' : 'กลับตามเวลาปกติ'}
              </div>
            )}
          </div>
        </div>
        {!todayOut && (
          <button
            onClick={() => onClockAction('OUT')}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>ลงเวลากลับ</span>
          </button>
        )}
      </div>

      {/* Today Leave or Official Notice Banner */}
      {(todayLeave || todayOfficial) && (
        <div className="space-y-2">
          {todayLeave && (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-200/70 text-sky-700 flex items-center justify-center shrink-0">
                  <CalendarOff className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-sky-800">วันนี้บันทึกแจ้งลาหยุด:</span> {todayLeave.note || 'ลาหยุด'}
                  <div className="text-[11px] text-sky-600 font-mono mt-0.5">เวลาบันทึก: {todayLeave.time} น. (อินเทอร์เน็ต)</div>
                </div>
              </div>
              <button
                onClick={onOpenLeaveModal}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-sky-100 text-sky-700 font-bold border border-sky-200 text-xs shrink-0 cursor-pointer"
              >
                แก้ไข / แจ้งเพิ่ม
              </button>
            </div>
          )}
          {todayOfficial && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-200/70 text-purple-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-purple-800">วันนี้บันทึกไปราชการ:</span> {todayOfficial.note || 'ไปราชการ'}
                  <div className="text-[11px] text-purple-600 font-mono mt-0.5">เวลาบันทึก: {todayOfficial.time} น. (อินเทอร์เน็ต)</div>
                </div>
              </div>
              <button
                onClick={onOpenOfficialModal}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-purple-100 text-purple-700 font-bold border border-purple-200 text-xs shrink-0 cursor-pointer"
              >
                แก้ไข / บันทึกเพิ่ม
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs">
          <div className="text-xs text-slate-400 font-bold">ลงเวลากลับ</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-800 mt-1">{totalOut}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">วัน</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="text-xs text-emerald-600 font-bold">กลับตรงเวลา</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 mt-1">{totalNormalOut}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ครั้ง</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-2xs">
          <div className="text-xs text-orange-600 font-bold">กลับก่อนเวลา</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-orange-600 mt-1">{totalEarly}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ครั้ง</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs">
          <div className="text-xs text-blue-600 font-bold">ลาหยุด</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-600 mt-1">{totalLeave}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ครั้ง</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-xs text-purple-600 font-bold">ไปราชการ</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-purple-600 mt-1">{totalOfficial}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ครั้ง</div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#7C3AED]" /> เมนูด่วนสำหรับครู
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onSelectTab('home')}
            className="p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer border border-emerald-200"
          >
            <Clock className="w-6 h-6 text-emerald-600" />
            <span>ลงเวลากลับ (GPS & MAC)</span>
          </button>
          <button
            onClick={() => onSelectTab('teacher-report')}
            className="p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer border border-purple-200"
          >
            <FileText className="w-6 h-6 text-[#7C3AED]" />
            <span>รายงานการลงเวลา</span>
          </button>
          <button
            onClick={onOpenLeaveModal}
            className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer border border-blue-200"
          >
            <CalendarOff className="w-6 h-6 text-blue-600" />
            <span>แจ้งลาหยุด</span>
          </button>
          <button
            onClick={onOpenOfficialModal}
            className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer border border-amber-200"
          >
            <Briefcase className="w-6 h-6 text-amber-600" />
            <span>แจ้งไปราชการ</span>
          </button>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-purple-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#7C3AED]" /> ประวัติการลงเวลาล่าสุด
          </h3>
          <button
            onClick={() => onSelectTab('teacher-report')}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
          >
            ดูทั้งหมด →
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">กำลังโหลดประวัติ...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">ยังไม่มีประวัติการลงเวลาในระบบ</div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.id || Math.random()}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    item.action === 'IN' ? 'bg-emerald-100 text-emerald-700' :
                    item.action === 'OUT' ? 'bg-amber-100 text-amber-700' :
                    item.action === 'LEAVE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {item.action === 'IN' ? <Clock className="w-4 h-4" /> :
                     item.action === 'OUT' ? <LogOut className="w-4 h-4" /> :
                     item.action === 'LEAVE' ? <CalendarOff className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">
                      {item.action === 'IN' ? 'ลงเวลาเข้างาน (IN)' :
                       item.action === 'OUT' ? 'ลงเวลากลับ (OUT)' :
                       item.action === 'LEAVE' ? `แจ้งลาหยุด (${formatTableLeaveDisplay(item.note) || 'ลาหยุด'})` :
                       `ไปราชการ (${formatTableOfficialDisplay(item.note) || 'ไปราชการ'})`}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{item.date} {item.time ? `• ${item.time} น.` : ''}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    item.action === 'IN' && item.isLate ? 'bg-amber-100 text-amber-800' :
                    item.action === 'OUT' && item.isEarly ? 'bg-orange-100 text-orange-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {item.action === 'IN' && item.isLate ? 'เข้าสาย' :
                     item.action === 'OUT' && item.isEarly ? 'กลับก่อนเวลา' : 'สำเร็จ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
