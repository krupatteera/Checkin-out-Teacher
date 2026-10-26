import React, { useState } from 'react';
import { X, Briefcase, Calendar, Clock, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { UserAccount } from '../types';
import { saveAttendanceRecord } from '../firebase';
import {
  getInternetIsoDate,
  getInternetTimeString,
  getInternetClockParts,
  formatThaiDateFromIso
} from '../utils/internetTime';
import { Swal } from '../utils/sweetAlert';

interface TeacherOfficialModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  currentDeviceMac?: string;
  onSuccess: () => void;
}

export const TeacherOfficialModal: React.FC<TeacherOfficialModalProps> = ({
  isOpen,
  onClose,
  user,
  currentDeviceMac = '',
  onSuccess
}) => {
  const todayIso = getInternetIsoDate();
  const [dutyDate, setDutyDate] = useState<string>(todayIso);
  const [period, setPeriod] = useState<string>('เต็มวัน');
  const [dutyType, setDutyType] = useState<string>('ประชุมราชการ / สัมมนา');
  const [locationDetails, setLocationDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const clockParts = getInternetClockParts();
  const selectedDateThai = formatThaiDateFromIso(dutyDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!locationDetails.trim()) {
      setErrorMsg('กรุณาระบุสถานที่หรือรายละเอียดคำสั่งไปราชการ');
      return;
    }

    try {
      setSubmitting(true);
      const currentTimeStr = getInternetTimeString();
      const currentEpoch = Date.now();

      const noteText = `${dutyType} (${period}): ${locationDetails.trim()}`;

      await saveAttendanceRecord({
        userId: user.id,
        employeeId: user.username || user.id,
        employeeName: user.fullname,
        action: 'OFFICIAL',
        date: dutyDate,
        dateThai: selectedDateThai,
        time: currentTimeStr,
        note: noteText,
        macAddress: currentDeviceMac,
        timestamp: currentEpoch
      });

      onClose();
      onSuccess();

      Swal.fire({
        title: 'บันทึกไปราชการสำเร็จ',
        html: `
          <div class="text-left text-xs text-slate-700 space-y-2">
            <p class="font-bold text-purple-800 text-sm">บันทึกข้อมูลการไปราชการเรียบร้อยแล้ว</p>
            <p><strong>ผู้แจ้ง:</strong> ${user.fullname}</p>
            <p><strong>วันที่:</strong> ${selectedDateThai}</p>
            <p><strong>ประเภท:</strong> ${dutyType} (${period})</p>
            <p><strong>สถานที่/รายละเอียด:</strong> ${locationDetails.trim()}</p>
            <div class="p-2 bg-purple-50 rounded-lg text-purple-900 text-[11px] font-semibold border border-purple-200 mt-2">
              ✓ บันทึกเวลาทำรายการ: ${currentTimeStr} น. ตามเวลามาตรฐานอินเทอร์เน็ต
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#7C3AED'
      });
    } catch (err: unknown) {
      console.error('Error saving official duty record:', err);
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-[#7C3AED] to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/30 shrink-0">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">บันทึกแจ้งไปราชการ</h3>
              <p className="text-xs text-purple-100 font-medium">ครูและบุคลากร: {user.fullname}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Internet Time Sync Banner */}
        <div className="bg-purple-50/80 px-5 py-2.5 border-b border-purple-100 flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>เวลามาตรฐานอินเทอร์เน็ต:</span>
            <span className="font-mono text-purple-800">{getInternetTimeString()} น.</span>
          </div>
          <div className="text-[11px] text-purple-700 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Asia/Bangkok (UTC+7)</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" /> วันที่ไปราชการ <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setDutyDate(todayIso)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  dutyDate === todayIso
                    ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                วันนี้ ({clockParts.thaiDate.split(' ')[0]})
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDutyDate(`${y}-${m}-${day}`);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  dutyDate !== todayIso
                    ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                วันทำการอื่น / ล่วงหน้า
              </button>
            </div>
            <div className="relative">
              <input
                type="date"
                value={dutyDate}
                onChange={(e) => setDutyDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              วันที่เลือก: <span className="font-bold text-purple-700">{selectedDateThai}</span>
            </p>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#7C3AED]" /> ช่วงเวลาไปราชการ <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['เต็มวัน', 'ครึ่งวันเช้า', 'ครึ่งวันบ่าย'].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    period === p
                      ? 'bg-purple-100 text-purple-800 border-purple-400 ring-2 ring-purple-300/40 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Duty Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ประเภทภารกิจราชการ <span className="text-rose-500">*</span>
            </label>
            <select
              value={dutyType}
              onChange={(e) => setDutyType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white"
            >
              <option value="ประชุมราชการ / สัมมนา">ประชุมราชการ / สัมมนา</option>
              <option value="เข้ารับการอบรม / พัฒนาวิชาชีพ">เข้ารับการอบรม / พัฒนาวิชาชีพ</option>
              <option value="นำนักเรียนร่วมกิจกรรม / แข่งขัน">นำนักเรียนร่วมกิจกรรม / แข่งขัน</option>
              <option value="นิเทศ / ติดตามงาน / ตรวจราชการ">นิเทศ / ติดตามงาน / ตรวจราชการ</option>
              <option value="ติดต่อราชการ สพป. / หน่วยงานภายนอก">ติดต่อราชการ สพป. / หน่วยงานภายนอก</option>
              <option value="ปฏิบัติหน้าที่ตามคำสั่งโรงเรียน">ปฏิบัติหน้าที่ตามคำสั่งโรงเรียน</option>
              <option value="ภารกิจราชการอื่นๆ">ภารกิจราชการอื่นๆ</option>
            </select>
          </div>

          {/* Location & Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              สถานที่ / คำสั่ง / รายละเอียดภารกิจ <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              rows={3}
              placeholder="ระบุสถานที่หรือเรื่อง เช่น ร่วมประชุมที่ สพป.อุดรธานี เขต 3, จัดค่ายวิชาการคณิตศาสตร์ ฯลฯ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-slate-50 placeholder:text-slate-400"
              required
            />
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-[#7C3AED] to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันบันทึกไปราชการ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
