import React, { useState } from 'react';
import { UserCheck, User, Upload, X, Loader2, Phone, Briefcase, Building2, KeyRound } from 'lucide-react';
import { UserAccount } from '../types';
import { updateUserProfileData } from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface EditProfileModalProps {
  user: UserAccount;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: UserAccount) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    password: user.password || '',
    fullname: user.fullname || '',
    position: user.position || '',
    department: user.department || '',
    phone: user.phone || ''
  });

  const [previewImg, setPreviewImg] = useState<string>(user.img || '');
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

    if (!formData.fullname.trim()) {
      Swal.fire({
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อ-นามสกุล',
        icon: 'warning'
      });
      return;
    }

    setLoading(true);

    try {
      const updatePayload: Partial<UserAccount> = {
        fullname: formData.fullname.trim(),
        position: formData.position.trim(),
        department: formData.department.trim(),
        phone: formData.phone.trim(),
        img: previewImg
      };

      if (formData.password.trim()) {
        updatePayload.password = formData.password.trim();
      }

      await updateUserProfileData(user.id, updatePayload);

      setLoading(false);

      const updatedUser: UserAccount = {
        ...user,
        ...updatePayload
      };

      Swal.fire({
        title: 'สำเร็จ',
        text: 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1600
      });

      onSuccess(updatedUser);
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: err instanceof Error ? err.message : String(err),
        icon: 'error'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[92vh]">
        {/* Header with Pastel Purple Theme */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">แก้ไขข้อมูลส่วนตัว</h3>
              <p className="text-[11px] sm:text-xs text-purple-100">รหัสผู้ใช้งาน: {user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs sm:text-sm">
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center justify-center pt-1">
            <div
              onClick={() => document.getElementById('editImgFile')?.click()}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-dashed border-[#A78BFA] hover:border-[#7C3AED] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-purple-50/50 transition-all group"
            >
              {previewImg ? (
                <img src={previewImg} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="w-7 h-7 text-[#7C3AED]" />
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">เปลี่ยนรูป</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity">
                แตะเพื่อเปลี่ยน
              </div>
            </div>
            <input
              id="editImgFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullname}
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เปลี่ยนรหัสผ่าน (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="รหัสผ่านใหม่"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่ง</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">กลุ่มสาระ / แผนก</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-slate-600">
              <span className="font-semibold">MAC Address ที่ลงทะเบียนไว้: </span>
              <span className="font-mono text-purple-900 font-bold">{user.registeredMac || 'ยังไม่ได้ผูกอุปกรณ์'}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-bold text-sm shadow-md shadow-purple-900/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกการเปลี่ยนแปลง...
                </>
              ) : (
                'บันทึกข้อมูลส่วนตัว'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
