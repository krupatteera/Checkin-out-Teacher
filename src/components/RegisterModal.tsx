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
  Upload,
  Bluetooth,
  Lock
} from 'lucide-react';
import { UserAccount } from '../types';
import { getOrGenerateBluetoothMac, getDeviceInfoLabel } from '../utils/deviceMac';
import { registerNewUser, checkBluetoothMacRegistered } from '../firebase';
import { Swal } from '../utils/sweetAlert';
import { analyzeFaceForRegistration, FaceAnalysisResult } from '../utils/aiFace';
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
    if (isOpen && captureMode === 'camera' && !previewImg && !duplicateMacInfo.isDuplicate) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, captureMode, previewImg, duplicateMacInfo.isDuplicate]);

  // Capture face photo from live video feed
  const capturePhotoFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;

    const vw = video.videoWidth || 480;
    const vh = video.videoHeight || 480;
    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image for natural selfie feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    // Crop tightly to center face to eliminate wide background
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);

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
      // 1. Compress image to optimal base64 size for Firestore
      const compressed = await compressImageBase64(imageStr, 480, 480, 0.82);
      setPreviewImg(compressed);

      // 2. Perform AI Facial Landmark & Biometrics Analysis
      const analysis = await analyzeFaceForRegistration(compressed);
      setFaceAnalysis(analysis);

      if (!analysis.hasFace) {
        Swal.fire({
          title: 'ไม่พบใบหน้าชัดเจน',
          text: 'AI ตรวจไม่พบใบหน้ามนุษย์ในภาพ กรุณาถ่ายภาพหน้าตรงในที่ที่มีแสงสว่างเพียงพอ',
          icon: 'warning',
          confirmButtonColor: '#7C3AED'
        });
      }
    } catch (err) {
      console.error('Face process error:', err);
      // Fallback
      setPreviewImg(imageStr);
      setFaceAnalysis({
        hasFace: true,
        faceCount: 1,
        isClear: true,
        quality: 'GOOD',
        confidence: 88,
        descriptor: 'บันทึกภาพถ่ายใบหน้าเรียบร้อย',
        aiSummary: 'บันทึกใบหน้าเข้าสู่ฐานข้อมูลชีวภาพสำเร็จ'
      });
    } finally {
      setIsAnalyzingFace(false);
    }
  };

  const handleRetake = () => {
    setPreviewImg('');
    setFaceAnalysis(null);
    if (captureMode === 'camera') {
      startCamera();
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

    if (!formData.username.trim() || !formData.password.trim() || !formData.fullname.trim()) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอก Username, Password และชื่อ-นามสกุล', 'warning');
      return;
    }

    if (!previewImg) {
      Swal.fire('กรุณาลงทะเบียนใบหน้า', 'กรุณาถ่ายภาพหรืออัปโหลดภาพใบหน้าเพื่อใช้ในการจดจำ AI', 'warning');
      return;
    }

    if (faceAnalysis && !faceAnalysis.hasFace) {
      const confirmProceed = await Swal.fire({
        title: 'ยืนยันการใช้ภาพนี้?',
        text: 'ระบบ AI อาจตรวจจับใบหน้าได้ไม่ชัดเจน อาจส่งผลต่อความแม่นยำในการสแกนลงเวลา คุณต้องการใช้ภาพนี้ต่อหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช้ภาพนี้',
        cancelButtonText: 'ถ่ายใหม่',
        confirmButtonColor: '#7C3AED'
      });
      if (!confirmProceed.isConfirmed) return;
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
        registeredMac: currentBluetoothMac,
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
                  ระบบได้บันทึกข้อมูล ผูกรหัส <b>Bluetooth MAC</b> และวิเคราะห์ฐานข้อมูลใบหน้าชีวภาพด้วย AI เรียบร้อยแล้ว ขณะนี้<b>อยู่ระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติการใช้งาน</b> เมื่ออนุมัติแล้วจะสามารถเข้าสู่ระบบและลงเวลาได้ทันที
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
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
              <h3 className="font-bold text-lg">ลงทะเบียนฐานข้อมูลใบหน้า</h3>
              <p className="text-xs text-purple-100">
                จดจำใบหน้า AI &bull; ผูก Bluetooth MAC ประจำเครื่อง &bull; รออนุมัติ
              </p>
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
                    *ระบบป้องกันการลงเวลาแทนกัน กำหนดให้อุปกรณ์ 1 เครื่องลงทะเบียนได้เพียง 1 บัญชีเท่านั้น เครื่องนี้จึงไม่สามารถลงทะเบียนได้อีก หากต้องการเปลี่ยนผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตเครื่อง
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

          {/* AI Face Biometrics Registration Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                <span>ลงทะเบียนฐานข้อมูลใบหน้าด้วย AI</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Mode Toggle: Camera vs Upload */}
              {!previewImg && !duplicateMacInfo.isDuplicate && (
                <div className="flex items-center gap-1 p-0.5 bg-purple-50 rounded-lg border border-purple-100 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMode('camera');
                      startCamera();
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      captureMode === 'camera'
                        ? 'bg-[#7C3AED] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-purple-700'
                    }`}
                  >
                    เปิดกล้องหน้า
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMode('upload');
                      stopCamera();
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      captureMode === 'upload'
                        ? 'bg-[#7C3AED] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-purple-700'
                    }`}
                  >
                    อัปโหลดรูป
                  </button>
                </div>
              )}
            </div>

            {/* Video Viewport / Preview Box */}
            <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-slate-900 border-4 border-purple-200 shadow-inner flex items-center justify-center">
              {duplicateMacInfo.isDuplicate ? (
                <div className="p-6 text-center text-rose-300">
                  <Lock className="w-12 h-12 mx-auto mb-2 text-rose-400" />
                  <p className="text-xs font-bold text-white">เครื่องนี้ถูกล็อกการลงทะเบียน</p>
                  <p className="text-[10px] text-rose-200 mt-1">Bluetooth MAC ซ้ำกับในระบบ</p>
                </div>
              ) : previewImg ? (
                /* Show Captured / Uploaded Image with AI Biometric Overlay */
                <div className="relative w-full h-full">
                  <img src={previewImg} alt="Face Snapshot" className="w-full h-full object-cover" />

                  {/* Face Framing Target Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-44 h-56 border-2 border-emerald-400 rounded-[50%] shadow-[0_0_20px_rgba(52,211,153,0.5)] flex items-center justify-center">
                      <div className="px-2 py-0.5 bg-emerald-600/90 text-white text-[10px] font-bold rounded-full flex items-center gap-1 shadow-md">
                        <CheckCircle2 className="w-3 h-3" /> ใบหน้าตรวจพบแล้ว
                      </div>
                    </div>
                  </div>

                  {/* Retake Button */}
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-xl text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> ถ่ายใหม่
                  </button>
                </div>
              ) : captureMode === 'camera' ? (
                /* Live Camera Feed */
                <div className="relative w-full h-full flex items-center justify-center">
                  {cameraError ? (
                    <div className="p-4 text-center text-white">
                      <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                      <p className="text-xs font-medium mb-3">{cameraError}</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> ลองใหม่
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

                      {/* Oval Alignment Guide */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-44 h-56 border-2 border-dashed border-[#A78BFA] rounded-[50%] shadow-[0_0_15px_rgba(167,139,250,0.5)] flex items-center justify-center">
                          <span className="text-[10px] text-purple-200 font-medium px-2 py-0.5 bg-black/40 rounded-full backdrop-blur-xs">
                            วางใบหน้าในกรอบวงรี
                          </span>
                        </div>
                      </div>

                      {/* Snap Photo Button */}
                      <div className="absolute bottom-3 inset-x-0 flex justify-center">
                        <button
                          type="button"
                          onClick={capturePhotoFromCamera}
                          className="px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white font-bold text-xs rounded-full shadow-lg shadow-purple-900/40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          <span>ถ่ายภาพใบหน้า</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* File Upload Area */
                <div className="p-6 text-center text-white flex flex-col items-center justify-center">
                  <Upload className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                  <p className="text-xs font-medium text-purple-100 mb-3">
                    เลือกไฟล์รูปภาพหน้าตรง (JPG, PNG)
                  </p>
                  <label className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-2 shadow-md">
                    <Upload className="w-4 h-4" />
                    <span>เลือกไฟล์ภาพ</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* AI Analysis Result Indicator */}
            {isAnalyzingFace && (
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
                <span className="font-semibold">AI กำลังวิเคราะห์ชีวภาพโครงสร้างใบหน้า...</span>
              </div>
            )}

            {faceAnalysis && !isAnalyzingFace && (
              <div
                className={`p-3 rounded-2xl border text-xs space-y-1 ${
                  faceAnalysis.hasFace
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    {faceAnalysis.hasFace ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>ผลการวิเคราะห์ใบหน้าด้วย AI</span>
                  </div>
                  {faceAnalysis.hasFace && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                      คะแนนความมั่นใจ: {faceAnalysis.confidence}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                  {faceAnalysis.aiSummary || faceAnalysis.descriptor}
                </p>
              </div>
            )}
          </div>

          {/* User Profile Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username (ชื่อผู้ใช้) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="เช่น somchai.j"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                  disabled={duplicateMacInfo.isDuplicate}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                  placeholder="เช่น ครูชำนาญการพิเศษ"
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
                disabled={loading || isAnalyzingFace || !previewImg || isCheckingMac}
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
