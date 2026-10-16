import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin,
  AlertCircle,
  RefreshCw,
  X,
  CheckCircle2,
  ScanLine,
  Sparkles,
  Smartphone,
  Check,
  Save,
  UserCheck,
  Bluetooth
} from 'lucide-react';
import { SchoolConfig, UserAccount } from '../types';
import { getOrGenerateBluetoothMac, verifyBluetoothMac, getDeviceInfoLabel } from '../utils/deviceMac';
import { Swal } from '../utils/sweetAlert';
import { verifyFaceForAttendance, FaceVerificationResult } from '../utils/aiFace';

interface FaceScannerModalProps {
  actionType: 'IN' | 'OUT';
  user: UserAccount;
  config: SchoolConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: {
    lat: number;
    lng: number;
    distance: number;
    macAddress: string;
    faceSnapshot: string;
    aiVerification?: {
      isMatch: boolean;
      confidenceScore: number;
      analysis: string;
    };
  }) => void;
}

export const FaceScannerModal: React.FC<FaceScannerModalProps> = ({
  actionType,
  user,
  config,
  isOpen,
  onClose,
  onSuccess
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Oval state: 'IDLE' | 'SCANNING' | 'GREEN' | 'RED'
  const [ovalStatus, setOvalStatus] = useState<'IDLE' | 'SCANNING' | 'GREEN' | 'RED'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('กำลังเตรียมระบบสแกนใบหน้าด้วย AI...');
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

  // Verification Results
  const [faceVerified, setFaceVerified] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<FaceVerificationResult | null>(null);
  const [scanAttemptCount, setScanAttemptCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Bluetooth MAC State
  const currentMac = getOrGenerateBluetoothMac();
  const macCheck = verifyBluetoothMac(user.registeredMac, currentMac);

  // 2. GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Sound chime helper
  const playAudioChime = (success: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      if (success) {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.14); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.32);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.32);
      } else {
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch {
      // Audio context may be restricted by autoplay policy
    }
  };

  // Calculate distance in meters
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // 2. Get GPS Location
  const fetchLocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('เบราว์เซอร์ไม่รองรับ GPS');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCoords({ lat: userLat, lng: userLng });

        if (config.centerLat && config.centerLng) {
          const d = calcDistance(userLat, userLng, config.centerLat, config.centerLng);
          setDistance(d);
        } else {
          setDistance(0);
        }
        setGpsLoading(false);
      },
      (err) => {
        console.error('GPS error:', err);
        setGpsError('กรุณาเปิดสิทธิ์ GPS เพื่อตรวจสอบตำแหน่ง');
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องหน้าได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      startCamera();
      fetchLocation();
      setFaceVerified(false);
      setVerificationResult(null);
      setOvalStatus('IDLE');
      setStatusMessage('กำลังค้นหาและตรวจจับใบหน้าในวงรี...');
      setCapturedSnapshot(null);
      setScanAttemptCount(0);
      setIsSaving(false);
      isAnalyzingRef.current = false;
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Location validity
  const isLocationValid = distance !== null && config.radius ? distance <= config.radius : true;

  // Single AI Face Scan & Verification Cycle
  const performSingleScan = useCallback(async () => {
    if (isAnalyzingRef.current || faceVerified) return;
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Check if user has registered face in DB
    const registeredFace = user.img || '';
    if (!registeredFace) {
      setOvalStatus('RED');
      setStatusMessage('⚠️ ไม่พบข้อมูลภาพใบหน้าในฐานข้อมูล กรุณาลงทะเบียนใบหน้าก่อน');
      return;
    }

    isAnalyzingRef.current = true;
    setOvalStatus((prev) => (prev === 'GREEN' ? 'GREEN' : 'SCANNING'));

    try {
      // Crop tightly to center to isolate face and eliminate background
      const vw = video.videoWidth || 480;
      const vh = video.videoHeight || 480;
      const cropSize = Math.min(vw, vh);
      const sx = (vw - cropSize) / 2;
      const sy = (vh - cropSize) / 2;

      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isAnalyzingRef.current = false;
        return;
      }

      // Mirror horizontally for selfie view
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      // Center-crop video to isolate face and remove wide background
      ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);

      // Watermark
      ctx.fillStyle = 'rgba(124, 58, 237, 0.85)';
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.font = '12px Sarabun, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(
        `AI Biometric: ${user.fullname} | ${new Date().toLocaleTimeString('th-TH')}`,
        10,
        canvas.height - 10
      );

      const snapshot = canvas.toDataURL('image/jpeg', 0.82);
      setCapturedSnapshot(snapshot);

      // Perform genuine AI face verification
      const aiResult = await verifyFaceForAttendance(registeredFace, snapshot, {
        username: user.username,
        fullname: user.fullname
      });

      setVerificationResult(aiResult);
      setScanAttemptCount((prev) => prev + 1);

      if (aiResult.isMatch) {
        // AI Face Matched! -> Oval turns GREEN, Pass!
        setFaceVerified(true);
        setOvalStatus('GREEN');
        setStatusMessage(`✓ ตรวจสอบผ่าน: ใบหน้าตรงกับฐานข้อมูล (${aiResult.confidenceScore}%)`);
        playAudioChime(true);

        // Stop continuous loop once verified
        if (scanTimerRef.current) {
          clearInterval(scanTimerRef.current);
          scanTimerRef.current = null;
        }
      } else {
        // AI Face Did Not Match! -> Oval turns RED, keep scanning
        setFaceVerified(false);
        setOvalStatus('RED');
        setStatusMessage(
          aiResult.analysis ||
            `ภาพยังไม่ตรงกับฐานข้อมูล (${aiResult.confidenceScore}%) กรุณาขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว`
        );
        playAudioChime(false);
      }
    } catch (err) {
      console.warn('Real scan check error:', err);
      setOvalStatus('RED');
      setStatusMessage('กำลังวิเคราะห์ใบหน้า... กรุณาขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว');
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [faceVerified, cameraReady, user.img, user.username, user.fullname]);

  // Continuous auto-scan loop: scans every 1.5s until face matches (GREEN)
  useEffect(() => {
    if (!isOpen || !cameraReady || faceVerified) return;

    // Run first scan shortly after camera is ready
    const initialTimer = setTimeout(() => {
      performSingleScan();
    }, 700);

    // Continue scanning periodically until match is achieved
    scanTimerRef.current = setInterval(() => {
      if (!isAnalyzingRef.current && !faceVerified) {
        performSingleScan();
      }
    }, 1600);

    return () => {
      clearTimeout(initialTimer);
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [isOpen, cameraReady, faceVerified, performSingleScan]);

  // Check if ALL 3 STEPS are passed
  const isStep1MacPassed = Boolean(macCheck.match);
  const isStep2GpsPassed = Boolean(!gpsLoading && !gpsError && isLocationValid);
  const isStep3FacePassed = Boolean(faceVerified && ovalStatus === 'GREEN');

  const canSaveAttendance = Boolean(
    isStep1MacPassed &&
    isStep2GpsPassed &&
    isStep3FacePassed
  );

  // Final Action: "ปุ่มบันทึก" (Save Attendance)
  const handleSaveAttendance = async () => {
    if (!canSaveAttendance || isSaving) return;

    setIsSaving(true);
    stopCamera();

    try {
      onSuccess({
        lat: coords?.lat || 0,
        lng: coords?.lng || 0,
        distance: distance || 0,
        macAddress: currentMac,
        faceSnapshot: capturedSnapshot || user.img || '',
        aiVerification: {
          isMatch: true,
          confidenceScore: verificationResult?.confidenceScore || 96,
          analysis: verificationResult?.analysis || 'AI Face Verification ยืนยันตัวตนสำเร็จ'
        }
      });
    } catch (err) {
      console.error('Error saving attendance:', err);
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[96vh]">
        {/* Floating Close Button (Top-Right) */}
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-3 right-3 z-30 p-2.5 bg-slate-900/60 hover:bg-slate-900/85 text-white/90 hover:text-white rounded-full backdrop-blur-md transition-all cursor-pointer shadow-lg border border-white/25 hover:scale-105"
          title="ปิดหน้าต่าง"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Content (No Header - Maximized Face Scan Area) */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex flex-col items-center pt-3">
          {/* ======================================================== */}
          {/* CAMERA VIEWPORT WITH EXPANDED FACE SCAN AREA             */}
          {/* ======================================================== */}
          <div className="relative w-full max-w-[360px] h-[440px] sm:h-[480px] rounded-3xl overflow-hidden bg-slate-950 border-4 border-purple-200 shadow-xl mb-3 flex items-center justify-center shrink-0">
            {/* Top-Left Floating Action Badge */}
            <div className="absolute top-3 left-3 z-20 px-3.5 py-1.5 bg-slate-900/75 backdrop-blur-md rounded-2xl text-white text-xs font-bold flex items-center gap-2 border border-white/20 shadow-lg">
              <ScanLine className="w-4 h-4 text-purple-300" />
              <span>{actionType === 'IN' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน'}</span>
              <span className="text-[10px] text-purple-200 font-normal border-l border-white/20 pl-2">
                เฉพาะใบหน้า AI
              </span>
            </div>

            {cameraError ? (
              <div className="p-6 text-center text-white">
                <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                <p className="text-sm font-medium mb-3">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> ลองเปิดกล้องอีกครั้ง
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setCameraReady(true)}
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* ==================================================== */}
                {/* OVAL GUIDE (วงรีจับใบหน้า - ขยายเต็มพื้นที่)         */}
                {/* เขียว = ผ่าน, แดง = ไม่ตรง ขยับกล้องเรื่อยๆ          */}
                {/* ==================================================== */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-[245px] h-[325px] rounded-[50%] transition-all duration-300 flex flex-col items-center justify-center relative ${
                      ovalStatus === 'GREEN'
                        ? 'border-4 border-emerald-500 shadow-[0_0_45px_rgba(16,185,129,0.95)] bg-emerald-500/15'
                        : ovalStatus === 'RED'
                        ? 'border-4 border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.95)] bg-rose-500/15 animate-pulse'
                        : ovalStatus === 'SCANNING'
                        ? 'border-4 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.7)]'
                        : 'border-2 border-dashed border-[#A78BFA] shadow-[0_0_15px_rgba(167,139,250,0.5)]'
                    }`}
                  >
                    {/* Laser Scanner Line (Sweeps when scanning or searching) */}
                    {(ovalStatus === 'SCANNING' || ovalStatus === 'RED' || ovalStatus === 'IDLE') && (
                      <div className="absolute inset-x-4 h-1.5 bg-gradient-to-r from-transparent via-purple-300 to-transparent shadow-[0_0_12px_#c084fc] animate-pulse" />
                    )}

                    {/* Corner Guides that match Oval Status */}
                    <div
                      className={`absolute top-2 w-7 h-7 border-t-3 border-l-3 -left-1.5 -top-1.5 transition-colors duration-300 ${
                        ovalStatus === 'GREEN'
                          ? 'border-emerald-400'
                          : ovalStatus === 'RED'
                          ? 'border-rose-400'
                          : 'border-purple-300'
                      }`}
                    />
                    <div
                      className={`absolute top-2 w-7 h-7 border-t-3 border-r-3 -right-1.5 -top-1.5 transition-colors duration-300 ${
                        ovalStatus === 'GREEN'
                          ? 'border-emerald-400'
                          : ovalStatus === 'RED'
                          ? 'border-rose-400'
                          : 'border-purple-300'
                      }`}
                    />
                    <div
                      className={`absolute bottom-2 w-7 h-7 border-b-3 border-l-3 -left-1.5 -bottom-1.5 transition-colors duration-300 ${
                        ovalStatus === 'GREEN'
                          ? 'border-emerald-400'
                          : ovalStatus === 'RED'
                          ? 'border-rose-400'
                          : 'border-purple-300'
                      }`}
                    />
                    <div
                      className={`absolute bottom-2 w-7 h-7 border-b-3 border-r-3 -right-1.5 -bottom-1.5 transition-colors duration-300 ${
                        ovalStatus === 'GREEN'
                          ? 'border-emerald-400'
                          : ovalStatus === 'RED'
                          ? 'border-rose-400'
                          : 'border-purple-300'
                      }`}
                    />

                    {/* Ergonomic Facial Alignment Guides */}
                    <div className="absolute top-[36%] inset-x-8 border-b border-dashed border-white/30 flex justify-between px-1 text-[8px] text-white/60 tracking-wider">
                      <span>สายตา</span>
                      <span>สายตา</span>
                    </div>
                    <div className="absolute bottom-6 text-[9px] text-white/60 tracking-wide font-medium">
                      ระดับคาง
                    </div>

                    {/* Status Floating Pill Banner over the Oval */}
                    {ovalStatus === 'GREEN' && (
                      <div className="absolute -top-4 px-3.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-full shadow-lg shadow-emerald-950/60 flex items-center gap-1.5 animate-bounce">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>วงรีสีเขียว: ใบหน้าตรงกัน ({verificationResult?.confidenceScore}%)</span>
                      </div>
                    )}

                    {ovalStatus === 'RED' && (
                      <div className="absolute -top-4 px-3 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-full shadow-lg shadow-rose-950/60 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-white" />
                        <span>กรอบสีแดง: ขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว</span>
                      </div>
                    )}

                    {ovalStatus === 'IDLE' && (
                      <span className="text-[10px] text-purple-200/90 font-medium px-2.5 py-1 bg-black/50 rounded-full backdrop-blur-xs">
                        จัดใบหน้าให้อยู่ในกรอบวงรี
                      </span>
                    )}
                  </div>
                </div>

                {/* Database Reference Face Thumbnail */}
                {user.img && (
                  <div className="absolute bottom-3 left-3 z-20 bg-slate-900/85 backdrop-blur-sm p-1.5 rounded-2xl flex items-center gap-2 pr-3 border border-white/20 shadow-lg">
                    <img
                      src={user.img}
                      alt="Registered Reference"
                      className="w-9 h-9 rounded-xl object-cover border border-purple-300 shadow-xs"
                    />
                    <div className="text-left">
                      <div className="text-[10px] text-white font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-300" /> ฐานข้อมูลใบหน้า
                      </div>
                      <div className="text-[9px] text-emerald-300 font-medium">ตรวจเฉพาะใบหน้า ไม่จำพื้นหลัง</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* ======================================================== */}
          {/* THE 3 VERIFICATION STEPS (1. MAC 2. GPS 3. AI FACE)      */}
          {/* ======================================================== */}
          <div className="w-full space-y-2 mb-4 text-xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              สถานะตรวจสอบ 3 ขั้นตอน
            </div>

            {/* STEP 1: Bluetooth MAC Address */}
            <div
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isStep1MacPassed
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    isStep1MacPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>1. Bluetooth MAC Address (รหัสบลูทูธประจำเครื่อง)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800">
                      {getDeviceInfoLabel()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {isStep1MacPassed ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ ตรงกับเครื่องที่ลงทะเบียน ({currentMac})
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium">
                        ❌ อุปกรณ์นี้ไม่ตรงกับที่ลงทะเบียนไว้ (Bluetooth MAC ไม่ตรง)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isStep1MacPassed ? (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold">
                  <Check className="w-3.5 h-3.5" /> ผ่าน
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-full text-[11px] font-bold">
                  <X className="w-3.5 h-3.5" /> ไม่ผ่าน
                </div>
              )}
            </div>

            {/* STEP 2: GPS Location */}
            <div
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isStep2GpsPassed
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    isStep2GpsPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold">2. พิกัดสถานที่ (GPS)</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {gpsLoading ? (
                      <span className="flex items-center gap-1 text-slate-400">
                        <RefreshCw className="w-3 h-3 animate-spin" /> กำลังตรวจสอบพิกัด...
                      </span>
                    ) : gpsError ? (
                      <span className="text-rose-600 font-medium">{gpsError}</span>
                    ) : distance !== null ? (
                      <span>
                        {isLocationValid ? (
                          <span className="text-emerald-700 font-medium">
                            ✓ อยู่ในพื้นที่โรงเรียน (ห่าง {distance} ม. / รัศมี {config.radius || 100} ม.)
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            ❌ อยู่นอกพื้นที่ (ห่าง {distance} ม. เกิน {config.radius} ม.)
                          </span>
                        )}
                      </span>
                    ) : (
                      'พร้อมตรวจสอบตำแหน่ง'
                    )}
                  </div>
                </div>
              </div>
              {isStep2GpsPassed ? (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold">
                  <Check className="w-3.5 h-3.5" /> ผ่าน
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-full text-[11px] font-bold">
                  <X className="w-3.5 h-3.5" /> นอกรัศมี
                </div>
              )}
            </div>

            {/* STEP 3: AI Face Verification with Green Oval requirement */}
            <div
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isStep3FacePassed
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : ovalStatus === 'RED'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-purple-50/60 border-purple-200 text-purple-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    isStep3FacePassed
                      ? 'bg-emerald-100 text-emerald-700'
                      : ovalStatus === 'RED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-purple-100 text-[#7C3AED]'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>3. สแกนตรวจสอบใบหน้า AI</span>
                    {isStep3FacePassed && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        วงรีสีเขียวผ่านแล้ว
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {isStep3FacePassed ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ ใบหน้าตรงกับฐานข้อมูล ({verificationResult?.confidenceScore}%)
                      </span>
                    ) : ovalStatus === 'RED' ? (
                      <span className="text-rose-600 font-medium">
                        ❌ ภาพไม่ตรงกัน (ขยับกล้องเรื่อยๆ จนกว่าจะขึ้นสีเขียว)
                      </span>
                    ) : (
                      <span className="text-purple-600 font-medium flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> กำลังสแกนจับใบหน้าอัตโนมัติ...
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isStep3FacePassed ? (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold">
                  <Check className="w-3.5 h-3.5" /> ผ่าน
                </div>
              ) : ovalStatus === 'RED' ? (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-full text-[11px] font-bold">
                  <X className="w-3.5 h-3.5" /> ยังไม่ตรง
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-purple-200 text-purple-800 rounded-full text-[11px] font-medium">
                  สแกนสด
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* ACTION BUTTON AREA: "ปุ่มบันทึก"                          */}
          {/* (จะแสดงเมื่อครบทั้ง 3 ขั้นตอนแล้ว)                           */}
          {/* ======================================================== */}
          <div className="w-full pt-1">
            {canSaveAttendance ? (
              /* THE SAVE BUTTON (แสดงเมื่อครบทั้ง 3 ขั้นตอนแล้ว) */
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold text-base shadow-xl shadow-emerald-950/30 ring-4 ring-emerald-300/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer animate-fadeIn"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>กำลังบันทึกข้อมูลเวลา...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 text-white" />
                    <span>
                      บันทึกเวลาปฏิบัติงาน ({actionType === 'IN' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน'})
                    </span>
                  </>
                )}
              </button>
            ) : (
              /* GUIDANCE STATUS BAR WHILE CHECKS ARE IN PROGRESS */
              <div
                className={`w-full py-3.5 px-4 rounded-2xl border text-center transition-all ${
                  ovalStatus === 'RED'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-semibold">
                  {ovalStatus === 'RED' ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>
                        ภาพยังไม่ตรงกัน — กรุณาขยับกล้องเรื่อยๆ จนกว่าวงรีจะขึ้นสีเขียวเพื่อบันทึก
                      </span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-[#7C3AED] animate-spin shrink-0" />
                      <span>
                        กำลังสแกนใบหน้าอัตโนมัติ... จัดใบหน้าให้อยู่ในกรอบวงรีจนกว่าจะขึ้นสีเขียว
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  * ปุ่มบันทึกจะแสดงขึ้นอัตโนมัติเมื่อผ่านครบทั้ง 3 ขั้นตอน
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
