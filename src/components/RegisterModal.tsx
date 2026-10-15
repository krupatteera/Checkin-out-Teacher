import React, { useState, useRef, useEffect } from 'react';
import {
  UserPlus,
  Camera,
  X,
  ShieldCheck,
  Sparkles,
  Loader2,
  Phone,
  Briefcase,
  Building2,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  RefreshCw,
  Upload
} from 'lucide-react';
import { UserAccount } from '../types';
import { getOrGenerateDeviceMac, getDeviceInfoLabel } from '../utils/deviceMac';
import { registerNewUser } from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { analyzeFaceForRegistration, FaceAnalysisResult } from '../utils/aiFace';
import { compressImageBase64 } from '../utils/imageUtils';

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

  // Face capture state
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [previewImg, setPreviewImg] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);

  // Stop camera when modal is closed or unmounted
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องหน้าได้ กรุณาอนุญาตการเข้าถึงหรือเลือกอัปโหลดไฟล์');
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (isOpen && captureMode === 'camera' && !previewImg) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, captureMode, previewImg]);

  // Capture face photo from live video feed
  const capturePhotoFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image for natural selfie feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();

    await processFaceImage(rawDataUrl);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const raw = event.target?.result as string;
        await processFaceImage(raw);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI analysis on captured / uploaded face image
  const processFaceImage = async (imageStr: string) => {
    setIsAnalyzingFace(true);
    setFaceAnalysis(null);
    try {
      const compressed = await compressImageBase64(imageStr, 480, 480, 0.82);
      setPreviewImg(compressed);

      const result = await analyzeFaceForRegistration(compressed);
      setFaceAnalysis(result);

      if (!result.hasFace) {
        Swal.fire({
          title: 'ไม่พบใบหน้าชัดเจน',
          text: 'AI ตรวจไม่พบใบหน้ามนุษย์ในภาพ กรุณาถ่ายใหม่ในที่ที่มีแสงสว่างเพียงพอ',
          icon: 'warning'
        });
      }
    } catch (err) {
      console.error('Face analysis error:', err);
    } finally {
      setIsAnalyzingFace(false);
    }
  };

  const handleRetakeFace = () => {
    setPreviewImg('');
    setFaceAnalysis(null);
    if (captureMode === 'camera') {
      startCamera();
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

    if (!previewImg) {
      Swal.fire({
        title: 'กรุณาลงทะเบียนใบหน้า',
        text: 'จำเป็นต้องถ่ายภาพหรืออัปโหลดใบหน้าเพื่อบันทึกฐานข้อมูลชีวภาพ AI ก่อนลงทะเบียน',
        icon: 'warning'
      });
      return;
    }

    if (faceAnalysis && !faceAnalysis.hasFace) {
      Swal.fire({
        title: 'ภาพใบหน้าไม่ผ่านเกณฑ์',
        text: 'AI ตรวจไม่พบใบหน้าที่ชัดเจน กรุณาถ่ายภาพใบหน้าใหม่อีกครั้ง',
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
        status: 'PENDING', // Always PENDING on register: wait for admin approval
        registeredMac: currentMac,
        img: previewImg,
        faceBiometrics: faceAnalysis
          ? {
              analyzedAt: new Date().toISOString(),
              quality: faceAnalysis.quality,
              confidence: faceAnalysis.confidence,
              descriptor: faceAnalysis.descriptor,
              aiSummary: faceAnalysis.aiSummary
            }
          : undefined
      };

      const result = await registerNewUser(userPayload);
      setLoading(false);

      if (result.ok) {
        stopCamera();
        await Swal.fire({
          title: 'ลงทะเบียนฐานข้อมูลใบหน้าสำเร็จ!',
          html: `
            <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
              <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <p class="font-bold text-purple-900 text-sm">ยินดีต้อนรับ ${formData.fullname}</p>
                <p class="text-slate-500 font-mono text-[11px] mt-0.5">Username: @${formData.username}</p>
              </div>
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                <p class="font-bold flex items-center gap-1.5 text-xs">
                  <span>⏳ สถานะ: รอผู้ดูแลระบบอนุมัติ (Pending)</span>
                </p>
                <p class="mt-1 text-[11px] leading-relaxed">
                  ระบบได้บันทึกข้อมูลและวิเคราะห์ฐานข้อมูลใบหน้าชีวภาพด้วย AI เรียบร้อยแล้ว ขณะนี้<b>อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติการใช้งาน</b> เมื่ออนุมัติแล้วจะสามารถเข้าสู่ระบบและลงเวลาได้ทันที
                </p>
              </div>
              <p class="text-[10px] text-slate-400">
                *รหัสอุปกรณ์ MAC: ${currentMac}
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[94vh]">
        {/* Header with Pastel Purple Theme */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">ลงทะเบียนฐานข้อมูลใบหน้า</h3>
              <p className="text-xs text-purple-100">จดจำใบหน้าชีวภาพด้วย AI • รอผู้ดูแลระบบอนุมัติ</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Hardware Device MAC Notice */}
          <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#7C3AED] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#7C3AED] text-xs sm:text-sm flex items-center gap-2">
                <span>จดจำ MAC Address อัตโนมัติ</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                  {deviceLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                รหัสเครื่อง: <span className="font-mono font-bold text-purple-900">{currentMac}</span>
              </p>
            </div>
          </div>

          {/* AI Face Biometrics Registration Section */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-purple-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                <span>ลงทะเบียนใบหน้าด้วย AI Biometric</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Mode switch (Camera / Upload) */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-purple-100 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode('camera');
                    if (!previewImg) startCamera();
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    captureMode === 'camera'
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> กล้องสด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode('upload');
                    stopCamera();
                    document.getElementById('faceUploadInput')?.click();
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    captureMode === 'upload'
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> อัปโหลด
                </button>
              </div>
            </div>

            {/* Hidden upload input */}
            <input
              id="faceUploadInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Face Viewport Area */}
            <div className="flex flex-col items-center justify-center">
              {previewImg ? (
                /* Captured Image & AI Analysis Display */
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-[#8B5CF6] shadow-md bg-slate-900 group">
                    <img src={previewImg} alt="Captured Face" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRetakeFace}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium transition-opacity cursor-pointer"
                    >
                      <RefreshCw className="w-5 h-5 mb-1" />
                      <span>ถ่าย / เลือกใหม่</span>
                    </button>
                  </div>

                  {/* AI Analysis Status Card */}
                  <div className="w-full mt-3">
                    {isAnalyzingFace ? (
                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-center gap-2 text-xs text-[#7C3AED] font-semibold animate-pulse">
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>AI กำลังวิเคราะห์ตรวจจับลักษณะชีวภาพใบหน้า...</span>
                      </div>
                    ) : faceAnalysis ? (
                      <div
                        className={`p-3 rounded-xl border text-xs ${
                          faceAnalysis.hasFace
                            ? 'bg-purple-50/70 border-purple-200 text-slate-700'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="flex items-center gap-1.5 text-[#7C3AED]">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>AI Face Biometric ผ่านเกณฑ์</span>
                          </span>
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            ความมั่นใจ {faceAnalysis.confidence}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {faceAnalysis.aiSummary || faceAnalysis.descriptor}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : captureMode === 'camera' ? (
                /* Live Camera Capture View */
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-purple-300 shadow-inner flex items-center justify-center">
                    {cameraError ? (
                      <div className="p-4 text-center text-white">
                        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                        <p className="text-xs text-rose-200 mb-2">{cameraError}</p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          ลองใหม่อีกครั้ง
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        {/* Oval Face Guide Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-44 h-56 border-2 border-dashed border-[#A78BFA] rounded-[50%] animate-pulse shadow-sm flex items-center justify-center">
                            <ScanLine className="w-8 h-8 text-white/50" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 text-[10px] text-white/90 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-xs">
                          วางใบหน้าให้อยู่ในกรอบวงรี
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    disabled={!isCameraActive}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs shadow-md shadow-purple-900/15 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> บันทึกภาพใบหน้านี้
                  </button>
                </div>
              ) : (
                /* Upload Prompt */
                <div
                  onClick={() => document.getElementById('faceUploadInput')?.click()}
                  className="w-full py-8 border-2 border-dashed border-purple-200 hover:border-[#7C3AED] rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-white transition-all group"
                >
                  <Upload className="w-8 h-8 text-[#7C3AED] group-hover:scale-110 transition-transform mb-1.5" />
                  <span className="text-xs font-bold text-slate-700">คลิกเพื่อเลือกภาพใบหน้าจากเครื่อง</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">รองรับไฟล์ JPG, PNG ที่เห็นใบหน้าชัดเจน</span>
                </div>
              )}
            </div>
          </div>

          {/* User Input Fields */}
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
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
                  placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* Pending Approval Notice */}
          <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/90 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <b>เงื่อนไขการเปิดใช้งาน:</b> หลังลงทะเบียน บัญชีจะอยู่ในสถานะ <b>"รออนุมัติ"</b>{' '}
              เพื่อให้ผู้ดูแลระบบตรวจสอบใบหน้าและข้อมูลก่อน จึงจะสามารถเข้าสู่ระบบและลงเวลาได้
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isAnalyzingFace || !previewImg}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-bold text-sm shadow-md shadow-purple-900/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกข้อมูลและใบหน้า...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> ยืนยันการลงทะเบียน (ส่งขออนุมัติ)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
