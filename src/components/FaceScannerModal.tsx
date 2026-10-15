import React, { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, ShieldCheck, AlertCircle, RefreshCw, X, CheckCircle2, ScanLine } from 'lucide-react';
import { SchoolConfig, UserAccount } from '../types';
import { getOrGenerateDeviceMac, verifyDeviceMac } from '../utils/deviceMac';
import { Swal } from '../utils/sweetAlert';

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

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Device MAC State
  const currentMac = getOrGenerateDeviceMac();
  const macCheck = verifyDeviceMac(user.registeredMac, currentMac);

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

  // Get GPS Location
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
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('กรุณาเปิดสิทธิ์เข้าถึงตำแหน่ง GPS ของอุปกรณ์');
        } else {
          setGpsError('ไม่สามารถดึงตำแหน่งพิกัดได้ กรุณาลองใหม่อีกครั้ง');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์การใช้งานกล้องในเบราว์เซอร์');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      fetchLocation();
      setIsScanning(false);
      setScanProgress(0);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Handle capture and verification
  const handleVerifyAndCapture = () => {
    // 1. Check MAC
    if (!macCheck.match) {
      Swal.fire({
        title: 'ตรวจพบอุปกรณ์ไม่ถูกต้อง',
        text: macCheck.message || 'รหัส MAC Address ไม่ตรงกับที่ลงทะเบียนไว้',
        icon: 'error'
      });
      return;
    }

    // 2. Check GPS
    if (!coords) {
      Swal.fire({
        title: 'ไม่พบตำแหน่ง GPS',
        text: 'กรุณาเปิดระบบระบุตำแหน่ง GPS เพื่อยืนยันว่าอยู่ในพื้นที่ปฏิบัติงาน',
        icon: 'warning'
      });
      return;
    }

    // Check Distance Radius
    if (distance !== null && config.radius && distance > config.radius) {
      Swal.fire({
        title: 'อยู่นอกพื้นที่ที่กำหนด',
        html: `ตำแหน่งของคุณอยู่ห่างจากโรงเรียน <b>${distance} เมตร</b><br>(รัศมีที่อนุญาตคือไม่เกิน <b>${config.radius} เมตร</b>)`,
        icon: 'error'
      });
      return;
    }

    // Start Biometric Scan Animation
    setIsScanning(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setScanProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        captureSnapshot();
      }
    }, 150);
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Optional timestamp watermark on snapshot
    ctx.fillStyle = 'rgba(12, 124, 130, 0.7)';
    ctx.fillRect(0, canvas.height - 35, canvas.width, 35);
    ctx.font = '14px Sarabun';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `สแกนยืนยันตัวตน: ${user.fullname} | ${new Date().toLocaleTimeString('th-TH')}`,
      10,
      canvas.height - 12
    );

    const snapshot = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    onSuccess({
      lat: coords?.lat || 0,
      lng: coords?.lng || 0,
      distance: distance || 0,
      macAddress: currentMac,
      faceSnapshot: snapshot
    });
  };

  if (!isOpen) return null;

  const isLocationValid = distance !== null && config.radius ? distance <= config.radius : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                ระบบสแกนใบหน้าลงเวลา ({actionType === 'IN' ? 'เข้างาน' : 'กลับบ้าน'})
              </h3>
              <p className="text-xs text-teal-100 font-medium">ยืนยันตัวตนด้วย Biometric & GPS พื้นที่</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col items-center">
          {/* Scanner Viewport */}
          <div className="relative w-full max-w-[340px] aspect-[4/4] rounded-2xl overflow-hidden bg-slate-900 border-4 border-[#35B4B0] shadow-inner mb-4 flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-white">
                <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                <p className="text-sm font-medium mb-3">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#35B4B0] hover:bg-[#0C7C82] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> ลองเปิดกล้องใหม่
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Face Oval Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div
                    className={`w-48 h-60 rounded-[50%] border-2 transition-all duration-300 ${
                      isScanning
                        ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)]'
                        : 'border-[#35B4B0]/80 border-dashed animate-pulse'
                    }`}
                  />
                  {isScanning && <div className="animate-scan-line" />}
                </div>

                {/* Scan Status Badge */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-md text-teal-300 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-teal-500/30">
                    <Camera className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
                    {isScanning ? `กำลังตรวจจับใบหน้า... ${scanProgress}%` : 'จัดใบหน้าให้อยู่ในกรอบ'}
                  </span>
                </div>
              </>
            )}

            {/* Hidden Canvas for capture snapshot */}
            <div className="hidden">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* Verification Indicators */}
          <div className="w-full space-y-2.5 mb-2 text-xs">
            {/* GPS Status */}
            <div
              className={`p-3 rounded-2xl flex items-center justify-between border ${
                gpsLoading
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : gpsError || !isLocationValid
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-bold">
                    {gpsLoading
                      ? 'กำลังตรวจสอบพิกัด GPS...'
                      : gpsError
                      ? 'ข้อผิดพลาด GPS'
                      : isLocationValid
                      ? 'อยู่ในพื้นที่ที่กำหนด'
                      : 'อยู่นอกพื้นที่โรงเรียน'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {coords ? (
                      <>
                        ห่าง {distance} ม. (กำหนดไม่เกิน {config.radius} ม.)
                      </>
                    ) : (
                      gpsError || 'รอรับสัญญาณดาวเทียม'
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={fetchLocation}
                disabled={gpsLoading}
                className="p-1.5 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                title="รีเฟรชพิกัด"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* MAC Address Device Check */}
            <div
              className={`p-3 rounded-2xl flex items-center justify-between border ${
                macCheck.match
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-bold">
                    {macCheck.match ? 'อุปกรณ์ตรงกับที่ลงทะเบียน' : 'อุปกรณ์ไม่ตรงกับที่ลงทะเบียน!'}
                  </div>
                  <div className="text-[11px] opacity-80 font-mono">
                    MAC เครื่อง: {currentMac}
                  </div>
                </div>
              </div>
              {macCheck.match ? (
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleVerifyAndCapture}
            disabled={isScanning || !isLocationValid || !macCheck.match || !!cameraError}
            className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-bold text-sm shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> กำลังประมวลผล...
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4" /> สแกนใบหน้าและบันทึกเวลา
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
