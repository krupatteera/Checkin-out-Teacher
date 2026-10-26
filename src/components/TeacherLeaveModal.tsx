import React, { useState } from 'react';
import { X, CalendarOff, Calendar, Clock, AlertCircle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { UserAccount } from '../types';
import { saveAttendanceRecord } from '../firebase';
import {
  getInternetIsoDate,
  getInternetTimeString,
  getInternetClockParts,
  formatThaiDateFromIso
} from '../utils/internetTime';
import { Swal } from '../utils/sweetAlert';

interface TeacherLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  currentDeviceMac?: string;
  onSuccess: () => void;
}

export const TeacherLeaveModal: React.FC<TeacherLeaveModalProps> = ({
  isOpen,
  onClose,
  user,
  currentDeviceMac = '',
  onSuccess
}) => {
  const todayIso = getInternetIsoDate();
  const [leaveDate, setLeaveDate] = useState<string>(todayIso);
  const [period, setPeriod] = useState<string>('เต็มวัน');
  const [leaveType, setLeaveType] = useState<string>('ลากิจ');
  const [reason, setReason] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>(user.phone || '');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const clockParts = getInternetClockParts();
  const selectedDateThai = formatThaiDateFromIso(leaveDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!reason.trim()) {
      setErrorMsg('กรุณาระบุเหตุผลหรือรายละเอียดการลา');
      return;
    }

    try {
      setSubmitting(true);
      const currentTimeStr = getInternetTimeString();
      const currentEpoch = Date.now();

      let noteText = `${leaveType} (${period}): ${reason.trim()}`;
      if (contactPhone.trim()) {
        noteText += ` [เบอร์ติดต่อ: ${contactPhone.trim()}]`;
      }

      await saveAttendanceRecord({
        userId: user.id,
        employeeId: user.username || user.id,
        employeeName: user.fullname,
        action: 'LEAVE',
        date: leaveDate,
        dateThai: selectedDateThai,
        time: currentTimeStr,
        note: noteText,
        macAddress: currentDeviceMac,
        timestamp: currentEpoch
      });

      onClose();
      onSuccess();

      Swal.fire({
        title: 'แจ้งลาหยุดสำเร็จ',
        html: `
          <div class="text-left text-xs text-slate-700 space-y-2">
            <p class="font-bold text-sky-800 text-sm">บันทึกข้อมูลการลาเรียบร้อยแล้ว</p>
            <p><strong>ผู้แจ้ง:</strong> ${user.fullname}</p>
            <p><strong>วันที่ลา:</strong> ${selectedDateThai}</p>
            <p><strong>ประเภท:</strong> ${leaveType} (${period})</p>
            <p><strong>เหตุผล:</strong> ${reason.trim()}</p>
            <div class="p-2 bg-sky-50 rounded-lg text-sky-900 text-[11px] font-semibold border border-sky-200 mt-2">
              ✓ บันทึกเวลาทำรายการ: ${currentTimeStr} น. ตามเวลามาตรฐานอินเทอร์เน็ต
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#0284c7'
      });
    } catch (err: unknown) {
      console.error('Error saving leave record:', err);
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/30 shrink-0">
              <CalendarOff className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">บันทึกแจ้งลาหยุดราชการ</h3>
              <p className="text-xs text-sky-100 font-medium">ครูและบุคลากร: {user.fullname}</p>
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
        <div className="bg-sky-50/80 px-5 py-2.5 border-b border-sky-100 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>เวลามาตรฐานอินเทอร์เน็ต:</span>
            <span className="font-mono text-sky-800">{getInternetTimeString()} น.</span>
          </div>
          <div className="text-[11px] text-sky-700 flex items-center gap-1">
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
              <Calendar className="w-3.5 h-3.5 text-sky-600" /> วันที่ต้องการลา <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setLeaveDate(todayIso)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  leaveDate === todayIso
                    ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
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
                  setLeaveDate(`${y}-${m}-${day}`);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  leaveDate !== todayIso
                    ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                วันทำการอื่น / ล่วงหน้า
              </button>
            </div>
            <div className="relative">
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              วันที่เลือก: <span className="font-bold text-sky-700">{selectedDateThai}</span>
            </p>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-600" /> ช่วงเวลาที่ลา <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['เต็มวัน', 'ครึ่งวันเช้า', 'ครึ่งวันบ่าย'].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    period === p
                      ? 'bg-sky-100 text-sky-800 border-sky-400 ring-2 ring-sky-300/40 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Leave Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ประเภทการลา <span className="text-rose-500">*</span>
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            >
              <option value="ลากิจ">ลากิจ (Personal Leave)</option>
              <option value="ลาป่วย">ลาป่วย (Sick Leave)</option>
              <option value="ลาพักผ่อน">ลาพักผ่อน (Vacation Leave)</option>
              <option value="ลาคลอดบุตร">ลาคลอดบุตร (Maternity Leave)</option>
              <option value="ลาเพื่อการศึกษา / ฝึกอบรม">ลาเพื่อการศึกษา / ฝึกอบรม</option>
              <option value="ลาอุปสมบท / พิธีฮัจญ์">ลาอุปสมบท / พิธีฮัจญ์</option>
              <option value="ลาอื่นๆ">ลาอื่นๆ</option>
            </select>
          </div>

          {/* Reason / Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เหตุผลหรือรายละเอียดการลา <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="ระบุเหตุผล เช่น มีนัดตรวจสุขภาพที่โรงพยาบาล, ติดภารกิจจำเป็นส่วนตัว ฯลฯ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 placeholder:text-slate-400"
              required
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เบอร์โทรศัพท์ติดต่อระหว่างลา (ถ้ามี)
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="เช่น 0812345678"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันแจ้งลาหยุด</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
