import React, { useEffect, useRef, useState } from 'react';
import { Settings, MapPin, Clock, Save, X, Navigation, Loader2, Building, ShieldCheck, Image as ImageIcon, KeyRound, Eye, EyeOff } from 'lucide-react';
import L from 'leaflet';
import { SchoolConfig } from '../types';
import { saveSchoolConfig } from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface AdminConfigModalProps {
  config: SchoolConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newConfig: SchoolConfig) => void;
}

export const AdminConfigModal: React.FC<AdminConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<SchoolConfig>({ ...config });
  const [loading, setLoading] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...config });

      setTimeout(() => {
        if (!mapContainerRef.current) return;

        const initialLat = config.centerLat || 17.413840;
        const initialLng = config.centerLng || 102.787260;
        const initialRadius = config.radius || 150;

        if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 16);

          L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: '© Google Satellite'
          }).addTo(map);

          // Marker
          const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

          // Circle for allowed check-in zone (pastel purple)
          const circle = L.circle([initialLat, initialLng], {
            color: '#8B5CF6',
            fillColor: '#C4B5FD',
            fillOpacity: 0.25,
            radius: initialRadius
          }).addTo(map);

          marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            setFormData((prev) => ({
              ...prev,
              centerLat: parseFloat(pos.lat.toFixed(6)),
              centerLng: parseFloat(pos.lng.toFixed(6))
            }));
            circle.setLatLng(pos);
          });

          mapInstanceRef.current = map;
          markerRef.current = marker;
          circleRef.current = circle;
        } else {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.setView([initialLat, initialLng], 16);
          markerRef.current?.setLatLng([initialLat, initialLng]);
          circleRef.current?.setLatLng([initialLat, initialLng]);
          circleRef.current?.setRadius(initialRadius);
        }
      }, 300);
    }

    return () => {
      if (!isOpen && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, config]);

  const updateRadiusOnMap = (rad: number) => {
    setFormData((prev) => ({ ...prev, radius: rad }));
    if (circleRef.current) {
      circleRef.current.setRadius(rad);
    }
  };

  const handleCurrentGps = () => {
    if (!navigator.geolocation) {
      Swal.fire('ข้อผิดพลาด', 'เบราว์เซอร์ไม่รองรับ GPS', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        setFormData((prev) => ({ ...prev, centerLat: lat, centerLng: lng }));

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
        }

        Swal.fire({
          title: 'ดึงพิกัดสำเร็จ',
          text: `พิกัดปัจจุบัน: ${lat}, ${lng}`,
          icon: 'success',
          timer: 1500
        });
      },
      () => {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเข้าถึงพิกัดปัจจุบันได้ กรุณาเปิดสิทธิ์ GPS', 'error');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.orgName.trim()) {
      Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุชื่อโรงเรียน', 'warning');
      return;
    }

    if (formData.adminPin && formData.adminPin.length !== 6) {
      Swal.fire('รหัส PIN ไม่ถูกต้อง', 'รหัส PIN ผู้ดูแลระบบต้องเป็นตัวเลข 6 หลักพอดี', 'warning');
      return;
    }

    setLoading(true);

    try {
      await saveSchoolConfig(formData);
      setLoading(false);

      Swal.fire({
        title: 'บันทึกสำเร็จ',
        text: 'อัปเดตข้อมูลระบบและขอบเขตพื้นที่เรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500
      });

      onSuccess(formData);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">ตั้งค่าระบบและขอบเขตพิกัดโรงเรียน</h3>
              <p className="text-xs text-purple-100">กำหนดชื่อหน่วยงาน, เกณฑ์เวลา และรัศมีลงเวลา</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Form Fields */}
            <div className="space-y-4">
              <div className="pb-2 border-b border-purple-100">
                <h4 className="text-sm font-bold text-[#7C3AED] flex items-center gap-2">
                  <Building className="w-4 h-4" /> ข้อมูลโรงเรียนและสังกัด
                </h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อโรงเรียน</label>
                <input
                  type="text"
                  required
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  placeholder="เช่น โรงเรียนอนุบาลศรีสุทโธ"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อสังกัด</label>
                <input
                  type="text"
                  required
                  value={formData.orgAffiliation}
                  onChange={(e) => setFormData({ ...formData, orgAffiliation: e.target.value })}
                  placeholder="เช่น สพป.อุดรธานี เขต 3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL โลโก้โรงเรียน (รูปภาพ)
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={formData.logoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="https://.../logo.png"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="pt-2 pb-2 border-b border-purple-100">
                <h4 className="text-sm font-bold text-[#7C3AED] flex items-center gap-2">
                  <Clock className="w-4 h-4" /> เกณฑ์เวลาปฏิบัติงาน
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-rose-600 mb-1">เวลาเข้าสาย (IN)</label>
                  <input
                    type="time"
                    required
                    value={formData.lateTime}
                    onChange={(e) => setFormData({ ...formData, lateTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-600 mb-1">เวลากลับก่อน (OUT)</label>
                  <input
                    type="time"
                    required
                    value={formData.earlyTime}
                    onChange={(e) => setFormData({ ...formData, earlyTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Admin 6-Digit PIN Update */}
              <div className="pt-2 pb-2 border-b border-purple-100">
                <h4 className="text-sm font-bold text-[#7C3AED] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> รหัส PIN ผู้ดูแลระบบ (Admin PIN)
                </h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัส PIN 6 หลักสำหรับเข้าสู่ระบบผู้ดูแลระบบ (เริ่มต้น 000000)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    maxLength={6}
                    value={formData.adminPin || '000000'}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData({ ...formData, adminPin: clean });
                    }}
                    placeholder="000000"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5CF6] text-sm bg-slate-50/50 font-mono font-bold tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  * รหัสเริ่มต้นคือ 000000 ใช้สำหรับยืนยันตัวตนผ่านปุ่มลอยมุมขวาล่าง
                </p>
              </div>

              <div className="pt-2 pb-2 border-b border-purple-100">
                <h4 className="text-sm font-bold text-[#7C3AED] flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> รัศมีพื้นที่อนุญาตให้ลงเวลา
                </h4>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รัศมีพื้นที่ (เมตร): <span className="text-[#7C3AED] font-extrabold">{formData.radius} เมตร</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="1000"
                  step="10"
                  value={formData.radius}
                  onChange={(e) => updateRadiusOnMap(parseInt(e.target.value, 10))}
                  className="w-full accent-[#7C3AED] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.centerLat}
                    onChange={(e) => setFormData({ ...formData, centerLat: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.centerLng}
                    onChange={(e) => setFormData({ ...formData, centerLng: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Satellite Map */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#7C3AED]" /> ลากหมุดเพื่อตั้งจุดศูนย์กลางโรงเรียน
                </span>
                <button
                  type="button"
                  onClick={handleCurrentGps}
                  className="text-xs px-2.5 py-1 rounded-lg bg-purple-50 text-[#7C3AED] hover:bg-purple-100 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Navigation className="w-3 h-3" /> ใช้พิกัดตำแหน่งปัจจุบัน
                </button>
              </div>

              <div
                ref={mapContainerRef}
                className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border-2 border-purple-200 shadow-inner z-0"
              />

              <p className="text-[11px] text-slate-500 mt-2 text-center">
                * วงกลมสีม่วงพาสเทลคือรัศมีเขตพื้นที่อนุญาตให้สแกนลงเวลา ({formData.radius} เมตร)
              </p>

              <div className="mt-auto pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white font-bold text-sm shadow-md shadow-purple-900/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึกการตั้งค่า...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> บันทึกการตั้งค่าระบบ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
