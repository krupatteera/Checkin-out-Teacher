import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Delete, RefreshCw, KeyRound, Lock } from 'lucide-react';
import { SchoolConfig } from '../types';
import { Swal } from '../utils/sweetAlert';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SchoolConfig;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  config,
  onSuccess
}) => {
  const [pin, setPin] = useState<string>('');
  const [isError, setIsError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Expected 6-digit PIN from config or default "000000"
  const expectedPin = config.adminPin || '000000';

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsError(false);
      setVerifying(false);
    }
  }, [isOpen]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setIsError(false);
      if (nextPin.length === 6) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  };

  const handleClear = () => {
    setPin('');
    setIsError(false);
  };

  const verifyPin = async (inputPin: string) => {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 200));

    if (inputPin === expectedPin) {
      setVerifying(false);
      onSuccess();
      onClose();
    } else {
      setVerifying(false);
      setIsError(true);
      Swal.fire({
        title: 'รหัส PIN ไม่ถูกต้อง',
        text: 'กรุณากรอกรหัส PIN 6 หลักที่ถูกต้อง (รหัสเริ่มต้นคือ 000000)',
        icon: 'error',
        confirmButtonColor: '#7C3AED',
        timer: 2000
      });
      setTimeout(() => {
        setPin('');
      }, 500);
    }
  };

  // Keyboard support for physical keyboards (0-9, Backspace, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, expectedPin]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col p-6 sm:p-7">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mt-2">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#9333EA] text-white flex items-center justify-center shadow-lg shadow-purple-900/25">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-lg">เข้าสู่ระบบผู้ดูแลระบบ</h3>
          <p className="text-xs text-slate-500 mt-1">
            กรอกรหัส PIN 6 หลักเพื่อเข้าใช้งาน (รหัสเริ่มต้น <span className="font-mono font-bold text-[#7C3AED]">000000</span>)
          </p>
        </div>

        {/* PIN Dots (6 circles) */}
        <div className="my-6 flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full transition-all duration-200 border-2 ${
                  isError
                    ? 'border-rose-500 bg-rose-500 scale-95 animate-shake'
                    : isFilled
                    ? 'border-[#7C3AED] bg-[#7C3AED] scale-110 shadow-md shadow-purple-500/40'
                    : 'border-slate-300 bg-slate-100'
                }`}
              />
            );
          })}
        </div>

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={verifying}
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-purple-50 active:bg-purple-100 text-slate-800 hover:text-[#7C3AED] font-bold text-xl font-mono shadow-2xs border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer select-none"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-rose-50 active:bg-rose-100 text-slate-500 hover:text-rose-600 font-bold text-sm shadow-2xs border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer select-none"
            title="ล้างทั้งหมด"
          >
            ล้าง
          </button>

          {/* Zero Button */}
          <button
            type="button"
            disabled={verifying}
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-purple-50 active:bg-purple-100 text-slate-800 hover:text-[#7C3AED] font-bold text-xl font-mono shadow-2xs border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer select-none"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-amber-50 active:bg-amber-100 text-slate-500 hover:text-amber-600 font-bold text-base shadow-2xs border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer select-none"
            title="ลบตัวเลขล่าสุด"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-5 text-center text-[11px] text-slate-400">
          {verifying ? (
            <span className="flex items-center justify-center gap-1.5 text-[#7C3AED] font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังตรวจสอบรหัส PIN...
            </span>
          ) : (
            <span>สามารถใช้แป้นพิมพ์ตัวเลข (Numpad) ได้โดยตรง</span>
          )}
        </div>
      </div>
    </div>
  );
};
