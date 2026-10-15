import React, { useState } from 'react';
import { UserPlus, Camera, X, ShieldCheck, Sparkles, Loader2, Phone, Briefcase, Building2, User, KeyRound } from 'lucide-react';
import { UserAccount } from '../types';
import { getOrGenerateDeviceMac, getDeviceInfoLabel } from '../utils/deviceMac';
import { registerNewUser } from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const currentMac = getOrGenerateDeviceMac();
  const deviceLabel = getDeviceInfoLabel();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
    position: '',
    department: '',
    phone: '',
    role: 'teacher' as 'admin' | 'teacher'
  });

  const [previewImg, setPreviewImg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImg(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.password.trim() || !formData.fullname.trim()) {
      Swal.fire({
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอก Username, Password และชื่อ-นามสกุลให้ครบถ้วน',
        icon: 'warning'
      });
      return;
    }

    setLoading(true);

    try {
      const userPayload: Omit<UserAccount, 'id'> = {
        username: formData.username.trim(),
        password: formData.password.trim(),
        fullname: formData.fullname.trim(),
        position: formData.position.trim() || 'ครูผู้สอน',
        department: formData.department.trim() || 'วิชาการ',
        phone: formData.phone.trim() || '',
        role: formData.role,
        status: 'ACTIVE',
        registeredMac: currentMac,
        img: previewImg || ''
      };

      const result = await registerNewUser(userPayload);

      setLoading(false);

      if (result.ok) {
        await Swal.fire({
          title: 'ลงทะเบียนสำเร็จ!',
          html: `บัญชี <b>${formData.username}</b> ได้รับการผูกกับอุปกรณ์นี้เรียบร้อยแล้ว<br><span class="text-xs text-teal-600 font-mono">MAC: ${currentMac}</span><br>สามารถเข้าสู่ระบบได้ทันที`,
          icon: 'success'
        });
        onClose();
        onSuccess();
      } else {
        Swal.fire({
          title: 'ลงทะเบียนไม่สำเร็จ',
          text: result.message,
          icon: 'error'
        });
      }
    } catch (err: unknown) {
      setLoading(false);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: err instanceof Error ? err.message : String(err),
        icon: 'error'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">ลงทะเบียนสมาชิกใหม่</h3>
              <p className="text-xs text-teal-100">จดจำอุปกรณ์และบันทึกข้อมูลครู/บุคลากร</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Hardware Device MAC Notice */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0C7C82] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#0C7C82] text-xs sm:text-sm flex items-center gap-2">
                <span>จดจำ MAC Address เครื่องนี้อัตโนมัติ</span>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">
                  {deviceLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                รหัสประจำเครื่อง: <span className="font-mono font-bold text-teal-800">{currentMac}</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                *ระบบจะล็อคการลงเวลากับเครื่องนี้ เพื่อความถูกต้องและป้องกันการลงเวลาแทนกัน
              </p>
            </div>
          </div>

          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center justify-center pt-1">
            <div
              onClick={() => document.getElementById('regImgFile')?.click()}
              className="relative w-24 h-24 rounded-full border-2 border-dashed border-[#35B4B0] hover:border-[#0C7C82] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-50 transition-all group"
            >
              {previewImg ? (
                <img src={previewImg} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-7 h-7 text-[#0C7C82] group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">อัปโหลดรูป</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity">
                เปลี่ยนรูป
              </div>
            </div>
            <input
              id="regImgFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username (ชื่อผู้ใช้) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="เช่น kru.somchai"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password (รหัสผ่าน) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น นายสมชาย ใจดี"
                value={formData.fullname}
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่ง</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="เช่น ครูชำนาญการพิเศษ"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">กลุ่มสาระ / แผนก</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  placeholder="เช่น 081-234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#35B4B0] text-sm bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-bold text-sm shadow-md hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกข้อมูล...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> ยืนยันการสมัครสมาชิก
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
