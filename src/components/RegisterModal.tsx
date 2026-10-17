import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  X,
  Loader2,
  Phone,
  Briefcase,
  Building2,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Bluetooth,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Camera,
  RefreshCw
} from 'lucide-react';
import { UserAccount } from '../types';
import { getOrGenerateBluetoothMac, getDeviceInfoLabel } from '../utils/deviceMac';
import { registerNewUser, checkBluetoothMacRegistered, findUserByUsername } from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { compressImageBase64 } from '../utils/imageUtils';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const currentBluetoothMac = getOrGenerateBluetoothMac();
  const deviceLabel = getDeviceInfoLabel();

  // Bluetooth MAC Duplication state
  const [isCheckingMac, setIsCheckingMac] = useState(true);
  const [duplicateMacInfo, setDuplicateMacInfo] = useState<{
    isDuplicate: boolean;
    existingUser?: { username: string; fullname: string; role: string };
  }>({ isDuplicate: false });

  // Form Fields: Username, Password, Profile
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullname: '',
    position: '',
    department: '',
    phone: '',
    role: 'teacher' as 'admin' | 'teacher'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [previewImg, setPreviewImg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Check Bluetooth MAC duplication whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setIsCheckingMac(true);
      checkBluetoothMacRegistered(currentBluetoothMac).then((res) => {
        setDuplicateMacInfo(res);
        setIsCheckingMac(false);
      });
    }
  }, [isOpen, currentBluetoothMac]);

  // Handle optional profile picture upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const raw = event.target?.result as string;
        try {
          const compressed = await compressImageBase64(raw, 320, 320, 0.8);
          setPreviewImg(compressed);
        } catch {
          setPreviewImg(raw);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Check duplicate Bluetooth MAC address before proceeding
    if (duplicateMacInfo.isDuplicate) {
      Swal.fire({
        title: 'ไม่อนุญาตให้ลงทะเบียน!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2">
            <p class="text-rose-600 font-bold text-sm">เครื่องนี้ถูกลงทะเบียนไว้ในระบบแล้ว (Bluetooth MAC ซ้ำกัน)</p>
            <div class="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
              <p><b>Bluetooth MAC:</b> <span class="font-mono text-purple-900">${currentBluetoothMac}</span></p>
              <p class="mt-1"><b>ผู้ลงทะเบียนเดิม:</b> คุณ ${duplicateMacInfo.existingUser?.fullname} (@${duplicateMacInfo.existingUser?.username})</p>
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              ระบบจำกัดให้อุปกรณ์ 1 เครื่อง สามารถลงทะเบียนได้เพียง 1 บัญชีเท่านั้น เพื่อป้องกันการลงเวลาแทนกัน หากเปลี่ยนเจ้าของเครื่อง กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตเครื่องก่อน
            </p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#7C3AED'
      });
      return;
    }

    const cleanUsername = formData.username.trim();
    const cleanPassword = formData.password.trim();
    const cleanConfirmPassword = formData.confirmPassword.trim();
    const cleanFullname = formData.fullname.trim();

    // Validate fields
    if (!cleanUsername) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุชื่อผู้ใช้งาน (Username)', 'warning');
      return;
    }

    if (cleanUsername.length < 3) {
      Swal.fire('ชื่อผู้ใช้สั้นเกินไป', 'ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร', 'warning');
      return;
    }

    if (!cleanPassword) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากำหนดรหัสผ่าน (Password)', 'warning');
      return;
    }

    if (cleanPassword.length < 4) {
      Swal.fire('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร', 'warning');
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      Swal.fire('รหัสผ่านไม่ตรงกัน', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'warning');
      return;
    }

    if (!cleanFullname) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ-นามสกุล', 'warning');
      return;
    }

    setLoading(true);

    try {
      // Check if username already exists
      const existing = await findUserByUsername(cleanUsername);
      if (existing) {
        setLoading(false);
        Swal.fire({
          title: 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว',
          text: `ชื่อผู้ใช้งาน "${cleanUsername}" มีอยู่ในระบบแล้ว กรุณาเลือกชื่อผู้ใช้งานอื่น`,
          icon: 'warning',
          confirmButtonColor: '#7C3AED'
        });
        return;
      }

      const userPayload: Omit<UserAccount, 'id'> = {
        username: cleanUsername,
        password: cleanPassword,
        fullname: cleanFullname,
        position: formData.position.trim() || 'ครูผู้สอน',
        department: formData.department.trim() || 'วิชาการ',
        phone: formData.phone.trim() || '',
        role: formData.role,
        status: 'PENDING', // Always PENDING on register: wait for admin approval
        registeredMac: currentBluetoothMac,
        img: previewImg || undefined
      };

      const result = await registerNewUser(userPayload);
      setLoading(false);

      if (result && result.ok) {
        await Swal.fire({
          title: 'ลงทะเบียนสำเร็จ!',
          html: `
            <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
              <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <p class="font-bold text-purple-900 text-sm">ยินดีต้อนรับ ${cleanFullname}</p>
                <p class="text-slate-600 text-xs mt-1">ชื่อผู้ใช้: <b class="font-mono text-purple-900">@${cleanUsername}</b></p>
                <p class="text-slate-500 text-[11px] mt-0.5">${formData.position || 'ครูผู้สอน'} &bull; ${formData.department || 'วิชาการ'}</p>
              </div>
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                <p class="font-bold flex items-center gap-1.5 text-xs">
                  <span>⏳ สถานะ: รอผู้ดูแลระบบอนุมัติ (Pending)</span>
                </p>
                <p class="mt-1 text-[11px] leading-relaxed">
                  ระบบได้บันทึกชื่อผู้ใช้ รหัสผ่าน และผูกรหัส <b>Bluetooth MAC</b> ประจำอุปกรณ์เรียบร้อยแล้ว ขณะนี้<b>อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติการใช้งาน</b> เมื่อได้รับการอนุมัติแล้วจะสามารถเข้าสู่ระบบและลงเวลาได้ทันที
                </p>
              </div>
              <p class="text-[10px] text-slate-400">
                *รหัสประจำอุปกรณ์ Bluetooth MAC: ${currentBluetoothMac}
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#7C3AED',
          confirmButtonText: 'รับทราบ'
        });
        onClose();
        onSuccess();
      } else {
        Swal.fire({
          title: 'ลงทะเบียนไม่สำเร็จ',
          text: result?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน',
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

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[94vh]">
        {/* Header with Pastel Purple Theme */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">ลงทะเบียนครูและบุคลากร</h3>
              <p className="text-xs text-purple-100">
                สมัครบัญชีด้วย User & Password &bull; ผูก Bluetooth MAC &bull; รออนุมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* ======================================================== */}
          {/* BLUETOOTH MAC ADDRESS & DUPLICATION CHECK BANNER         */}
          {/* ======================================================== */}
          {isCheckingMac ? (
            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 flex items-center gap-2.5 text-xs text-purple-800">
              <RefreshCw className="w-4 h-4 animate-spin text-[#7C3AED]" />
              <span>กำลังตรวจสอบ Bluetooth MAC Address ของอุปกรณ์...</span>
            </div>
          ) : duplicateMacInfo.isDuplicate ? (
            /* IF DUPLICATE: SHOW PROMINENT RED BLOCKING BANNER */
            <div className="p-4 bg-rose-50 rounded-2xl border-2 border-rose-300 text-rose-900 space-y-2 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-rose-700 flex items-center gap-2">
                    <span>ไม่อนุญาตให้ลงทะเบียนจากเครื่องนี้</span>
                    <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-bold">
                      Bluetooth MAC ซ้ำ
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1">
                    อุปกรณ์นี้ (Bluetooth MAC: <span className="font-mono font-bold text-rose-950">{currentBluetoothMac}</span>) ได้ถูกลงทะเบียนไปแล้วโดย:
                  </p>
                  <div className="mt-1.5 p-2.5 bg-white/90 rounded-xl border border-rose-200 text-xs">
                    <span className="font-bold text-slate-800">คุณ {duplicateMacInfo.existingUser?.fullname}</span>
                    <span className="text-slate-500 font-mono text-[11px] ml-1.5">(@{duplicateMacInfo.existingUser?.username})</span>
                  </div>
                  <p className="text-[11px] text-rose-600 mt-1.5 leading-relaxed">
                    *ระบบป้องกันการลงเวลาแทนกัน กำหนดให้อุปกรณ์ 1 เครื่องลงทะเบียนได้เพียง 1 บัญชีเท่านั้น หากต้องการเปลี่ยนผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตเครื่อง
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* IF NOT DUPLICATE: SHOW REASSURING GREEN/PURPLE BANNER */
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/90 flex items-start gap-3">
              <Bluetooth className="w-5 h-5 text-[#7C3AED] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-[#7C3AED] text-xs sm:text-sm flex items-center gap-2">
                  <span>Bluetooth MAC Address ประจำเครื่อง</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> พร้อมลงทะเบียน
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  รหัสบลูทูธ: <span className="font-mono font-bold text-purple-950">{currentBluetoothMac}</span>{' '}
                  <span className="text-[10px] text-slate-400">({deviceLabel})</span>
                </p>
                <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                  ✓ ตรวจสอบแล้ว: เครื่องนี้ยังไม่เคยใช้ลงทะเบียนในระบบ
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* USERNAME & PASSWORD CREDENTIALS SECTION                  */}
          {/* ======================================================== */}
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-[#7C3AED] mb-1">
              <KeyRound className="w-4 h-4 text-[#7C3AED]" />
              <span>ข้อมูลบัญชีผู้ใช้งาน (สำหรับเข้าสู่ระบบ)</span>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="เช่น kru_somchai, somchai01 (อังกฤษ/ตัวเลข)"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-white disabled:bg-slate-100 font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">ใช้สำหรับพิมพ์ล็อกอินเข้าสู่ระบบ (ตัวอักษรภาษาอังกฤษหรือตัวเลข)</p>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัสผ่าน (Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={duplicateMacInfo.isDuplicate}
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-white disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    disabled={duplicateMacInfo.isDuplicate}
                    placeholder="พิมพ์รหัสผ่านซ้ำอีกครั้ง"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-white disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TEACHER PROFILE INFO                                     */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={duplicateMacInfo.isDuplicate}
                placeholder="เช่น นายสมชาย ใจดี"
                value={formData.fullname}
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่ง</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="เช่น ครูผู้สอน, ครูชำนาญการ"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">กลุ่มสาระ / แผนก</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="เช่น 081-234-5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Optional Profile Picture Upload */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              รูปภาพโปรไฟล์ (ไม่บังคับ)
            </label>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-purple-100 border border-purple-200 shrink-0 flex items-center justify-center">
                {previewImg ? (
                  <img src={previewImg} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-[#7C3AED]" />
                )}
              </div>
              <div className="flex-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-[#7C3AED] rounded-xl text-xs font-bold border border-purple-200 cursor-pointer shadow-xs transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>เลือกรูปภาพ</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {previewImg && (
                  <button
                    type="button"
                    onClick={() => setPreviewImg('')}
                    className="ml-2 text-xs text-rose-500 hover:underline cursor-pointer"
                  >
                    ลบรูป
                  </button>
                )}
                <p className="text-[10px] text-slate-400 mt-1">อัปโหลดรูปภาพเพื่อใช้แสดงในหน้าโปรไฟล์และรายงาน</p>
              </div>
            </div>
          </div>

          {/* Pending Approval Notice */}
          <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/90 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <b>เงื่อนไขการเปิดใช้งาน:</b> หลังลงทะเบียน บัญชีจะอยู่ในสถานะ <b>"รออนุมัติ"</b>{' '}
              เพื่อให้ผู้ดูแลระบบตรวจสอบข้อมูลก่อน จึงจะสามารถเข้าสู่ระบบด้วย Username & Password เพื่อลงเวลาได้
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            {duplicateMacInfo.isDuplicate ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300"
              >
                <Lock className="w-4 h-4 text-rose-500" />
                <span>เครื่องนี้ลงทะเบียนแล้ว (Bluetooth MAC ซ้ำกันในระบบ)</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || isCheckingMac}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-bold text-sm shadow-md shadow-purple-900/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกข้อมูลการลงทะเบียน...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> ยืนยันการลงทะเบียน (ส่งขออนุมัติ)
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
