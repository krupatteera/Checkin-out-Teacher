import React from 'react';
import {
  Clock,
  UserCheck,
  MapPin,
  Users,
  Settings,
  FileClock,
  LogOut,
  Sparkles,
  CalendarCheck,
  CalendarOff,
  Briefcase,
  Home,
  Shield,
  Smartphone,
  School,
  X,
  FileText,
  Calendar,
  Trash2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { SchoolConfig, UserAccount } from '../types';

interface NavigationProps {
  user: UserAccount;
  config: SchoolConfig;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  onClockAction: (action: 'IN' | 'OUT') => void;
  onOpenLeaveModal: () => void;
  onOpenOfficialModal: () => void;
  onOpenConfigModal: () => void;
  onOpenUsersModal: () => void;
  onOpenEditProfile: () => void;
  onOpenHolidaysModal: () => void;
  onOpenDeleteDataModal?: () => void;
  gpsDistance?: number | null;
  gpsAccuracy?: number | null;
  onRefreshGps?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  user,
  config,
  currentTab,
  onSelectTab,
  onLogout,
  mobileMenuOpen,
  onCloseMobileMenu,
  onClockAction,
  onOpenLeaveModal,
  onOpenOfficialModal,
  onOpenConfigModal,
  onOpenUsersModal,
  onOpenEditProfile,
  onOpenHolidaysModal,
  onOpenDeleteDataModal,
  gpsDistance = null,
  gpsAccuracy = null,
  onRefreshGps
}) => {
  const isAdmin = user.role === 'admin';
  const allowedRadius = config.radius || 150;
  const accuracyTolerance = Math.min((gpsAccuracy || 15) * 0.45, 25);
  const isInRadius = gpsDistance !== null && gpsDistance <= (allowedRadius + accuracyTolerance);
  const isOutsideArea = gpsDistance !== null && gpsDistance > (allowedRadius + accuracyTolerance);

  // iPhone Shortcut Icons definitions (Separated: Admin has NO check-in/attendance icons)
  const shortcutIcons = isAdmin
    ? [
        {
          id: 'admin-dashboard',
          name: 'ภาพรวมประจำวัน',
          desc: 'Daily Overview',
          gradient: 'from-[#8B5CF6] to-[#7C3AED]',
          icon: CalendarCheck,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-dashboard');
          }
        },
        {
          id: 'admin-summary',
          name: 'สรุปรายบุคคล',
          desc: 'Monthly Summary',
          gradient: 'from-[#A78BFA] to-[#8B5CF6]',
          icon: Users,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-summary');
          }
        },
        {
          id: 'admin-map',
          name: 'แผนที่ดาวเทียม',
          desc: 'Satellite Map',
          gradient: 'from-[#F59E0B] to-[#D97706]',
          icon: MapPin,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-map');
          }
        },
        {
          id: 'users',
          name: 'จัดการสมาชิก',
          desc: 'Manage Teachers',
          gradient: 'from-[#3B82F6] to-[#2563EB]',
          icon: Users,
          onClick: () => {
            onCloseMobileMenu();
            onOpenUsersModal();
          }
        },
        {
          id: 'settings',
          name: 'ตั้งค่าระบบ',
          desc: 'Settings',
          gradient: 'from-[#C4B5FD] to-[#8B5CF6]',
          icon: Settings,
          onClick: () => {
            onCloseMobileMenu();
            onOpenConfigModal();
          }
        },
        {
          id: 'holidays',
          name: 'กำหนดวันหยุด',
          desc: 'School Calendar',
          gradient: 'from-[#EC4899] to-[#BE185D]',
          icon: Calendar,
          onClick: () => {
            onCloseMobileMenu();
            onOpenHolidaysModal();
          }
        },
        {
          id: 'admin-logs',
          name: 'ประวัติระบบ',
          desc: 'System Logs',
          gradient: 'from-[#6366F1] to-[#4338CA]',
          icon: FileClock,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-logs');
          }
        },
        {
          id: 'admin-manual-clock',
          name: 'ลงเวลาด้วยระบบ',
          desc: 'Manual Clock',
          gradient: 'from-emerald-500 to-green-700',
          icon: Clock,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-manual-clock');
          }
        },
        {
          id: 'delete-data',
          name: 'ลบข้อมูลระบบ',
          desc: 'Data Purge',
          gradient: 'from-rose-500 to-red-700',
          icon: Trash2,
          onClick: () => {
            onCloseMobileMenu();
            onOpenDeleteDataModal?.();
          }
        }
      ]
    : [
        {
          id: 'teacher-dashboard',
          name: 'แดชบอร์ดภาพรวม',
          desc: 'Dashboard',
          gradient: 'from-[#7C3AED] to-[#8B5CF6]',
          icon: Sparkles,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('teacher-dashboard');
          }
        },

        {
          id: 'out',
          name: 'ลงเวลากลับ',
          desc: 'Check-Out',
          gradient: 'from-[#F59E0B] to-[#D97706]',
          icon: LogOut,
          onClick: () => {
            onCloseMobileMenu();
            onClockAction('OUT');
          }
        },
        {
          id: 'report',
          name: 'รายงานการลงเวลา',
          desc: 'Monthly Report',
          gradient: 'from-[#6366F1] to-[#4338CA]',
          icon: FileText,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('teacher-report');
          }
        },
        {
          id: 'leave',
          name: 'แจ้งลาหยุด',
          desc: 'Leave Request',
          gradient: 'from-[#3B82F6] to-[#1D4ED8]',
          icon: CalendarOff,
          onClick: () => {
            onCloseMobileMenu();
            onOpenLeaveModal();
          }
        },
        {
          id: 'official',
          name: 'ไปราชการ',
          desc: 'Official Duty',
          gradient: 'from-[#8B5CF6] to-[#6D28D9]',
          icon: Briefcase,
          onClick: () => {
            onCloseMobileMenu();
            onOpenOfficialModal();
          }
        },
        {
          id: 'profile',
          name: 'ข้อมูลส่วนตัว',
          desc: 'Profile',
          gradient: 'from-[#EC4899] to-[#BE185D]',
          icon: UserCheck,
          onClick: () => {
            onCloseMobileMenu();
            onOpenEditProfile();
          }
        }
      ];

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Modern Sidebar (Desktop Fixed + Mobile Off-Canvas Drawer) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 shadow-xl flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header with School Logo */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo"
                className="w-11 h-11 rounded-2xl object-cover shadow-md border-2 border-purple-100 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
                <School className="w-6 h-6" />
              </div>
            )}
            <div className="overflow-hidden">
              <h1 className="text-sm font-extrabold text-slate-800 truncate leading-tight">
                {config.orgName}
              </h1>
              <p className="text-[11px] text-purple-700 font-semibold truncate mt-0.5">
                {config.orgAffiliation}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobileMenu}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 lg:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content (Scrollable) */}
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {/* Main Navigation Menu (สำหรับคุณครูเท่านั้น - ผู้ดูแลระบบไม่มีส่วนนี้) */}
          {!isAdmin && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2">
                เมนูสำหรับครู
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => {
                      onSelectTab('teacher-dashboard');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'teacher-dashboard'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 transition-transform group-hover:scale-110" />
                      <span>แดชบอร์ดภาพรวม</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        currentTab === 'teacher-dashboard' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      หน้าแรก
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onSelectTab('home');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'home'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 transition-transform group-hover:scale-110" />
                      <span>ลงเวลาปฏิบัติงาน (GPS & MAC)</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        currentTab === 'home' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      ลงเวลา
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenLeaveModal();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-sky-700 hover:bg-sky-50 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarOff className="w-4 h-4 text-sky-600 transition-transform group-hover:scale-110" />
                      <span>แจ้งลาหยุดราชการ (Leave)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800">
                      แจ้งลา
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenOfficialModal();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-purple-700 hover:bg-purple-50 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-4 h-4 text-purple-600 transition-transform group-hover:scale-110" />
                      <span>บันทึกไปราชการ (Official)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                      ไปราชการ
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onSelectTab('teacher-report');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'teacher-report'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 transition-transform group-hover:scale-110" />
                      <span>รายงานการลงเวลา (ประจำเดือน / พิมพ์)</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        currentTab === 'teacher-report' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      รายงาน
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          )}

          {/* Admin Menu (สำหรับผู้ดูแลระบบเท่านั้น - ไม่มีการลงเวลาปฏิบัติงาน) */}
          {isAdmin && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>การจัดการระบบ (Admin Panel)</span>
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => {
                      onSelectTab('admin-dashboard');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'admin-dashboard'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>ภาพรวมประจำวัน</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onSelectTab('admin-summary');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'admin-summary'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>สรุปรายบุคคล (เดือน)</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onSelectTab('admin-map');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'admin-map'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <MapPin className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>แผนที่ดาวเทียม</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenUsersModal();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <Users className="w-4 h-4 text-[#8B5CF6] transition-transform group-hover:scale-110" />
                    <span>จัดการสมาชิก/ครู</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenConfigModal();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <Settings className="w-4 h-4 text-[#8B5CF6] transition-transform group-hover:scale-110" />
                    <span>ตั้งค่าระบบ/ขอบเขต</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenHolidaysModal();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <Calendar className="w-4 h-4 text-[#8B5CF6] transition-transform group-hover:scale-110" />
                    <span>กำหนดวันหยุดโรงเรียน</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onSelectTab('admin-logs');
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                      currentTab === 'admin-logs'
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <FileClock className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>ประวัติระบบ (Logs)</span>
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => {
                      onCloseMobileMenu();
                      onOpenDeleteDataModal?.();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:translate-x-1 transition-all cursor-pointer group"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500 transition-transform group-hover:scale-110" />
                    <span>เมนูลบข้อมูล (Database)</span>
                  </button>
                </li>
              </ul>
            </div>
          )}

          {/* iPhone Shortcut Apps Panel */}
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#8B5CF6]" /> เมนูทางลัด iPhone Icons
            </div>
            <div className="grid grid-cols-3 gap-2.5 px-1">
              {shortcutIcons.map((sc) => {
                const IconComponent = sc.icon;
                return (
                  <button
                    key={sc.id}
                    onClick={sc.onClick}
                    className="flex flex-col items-center p-2 rounded-2xl hover:bg-purple-50/50 transition-all cursor-pointer group"
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${sc.gradient} text-white flex items-center justify-center ios-icon-shadow ios-icon-glow transition-all`}
                    >
                      <IconComponent className="w-6 h-6 drop-shadow-sm" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 mt-1.5 text-center leading-tight line-clamp-1">
                      {sc.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Teacher Live Location & Radius Status Widget in Sidebar */}
        {!isAdmin && (
          <div className="px-4 mb-3">
            <div
              className={`p-3 rounded-2xl border transition-all text-left shadow-xs ${
                gpsDistance === null
                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : isInRadius
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-200/50'
                  : 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-200/50'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {gpsDistance !== null && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isInRadius ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        gpsDistance === null
                          ? 'bg-slate-400'
                          : isInRadius
                          ? 'bg-emerald-600'
                          : 'bg-rose-600'
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider truncate">
                    {gpsDistance === null
                      ? 'ค้นหาพิกัด GPS'
                      : isInRadius
                      ? 'อยู่ในรัศมีลงเวลา ✓'
                      : 'อยู่นอกพื้นที่โรงเรียน ✕'}
                  </span>
                </div>
                {onRefreshGps && (
                  <button
                    type="button"
                    onClick={onRefreshGps}
                    className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer shrink-0"
                    title="รีเฟรชพิกัดตำแหน่ง"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="text-[11px] font-bold flex items-center justify-between">
                <span className="text-slate-500 font-normal">ระยะห่าง:</span>
                <span className="font-mono font-extrabold">
                  {gpsDistance !== null ? `${gpsDistance} ม.` : '...'}
                  <span className="text-[10px] text-slate-400 font-normal"> (รัศมี {allowedRadius} ม.)</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Footer with User Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between gap-3">
            <div
              onClick={() => {
                onCloseMobileMenu();
                onOpenEditProfile();
              }}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
            >
              <img
                src={
                  user.img ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.fullname
                  )}&background=8B5CF6&color=fff`
                }
                alt={user.fullname}
                className="w-9 h-9 rounded-full object-cover border border-purple-200 shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="truncate">
                <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#7C3AED] transition-colors">
                  {user.fullname}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.position || 'ครูผู้สอน'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sticky Live Location Ribbon (ชัดเจน มองเห็นทันทีทุกขณะ) */}
      {!isAdmin && currentTab === 'home' && (
        <div
          onClick={onRefreshGps}
          className={`lg:hidden fixed bottom-[68px] left-2 right-2 sm:left-4 sm:right-4 z-40 px-3 py-1.5 rounded-2xl shadow-lg border flex items-center justify-between gap-2 backdrop-blur-md cursor-pointer transition-all ${
            gpsDistance === null
              ? 'bg-slate-900/90 text-white border-slate-700'
              : isInRadius
              ? 'bg-emerald-600/95 text-white border-emerald-300 ring-2 ring-emerald-300/40 shadow-emerald-950/20'
              : 'bg-rose-600/95 text-white border-rose-300 ring-2 ring-rose-300/40 shadow-rose-950/20 animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {gpsDistance !== null && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isInRadius ? 'bg-emerald-300' : 'bg-rose-300'
                  }`}
                />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  gpsDistance === null
                    ? 'bg-slate-400'
                    : isInRadius
                    ? 'bg-emerald-300'
                    : 'bg-yellow-300'
                }`}
              />
            </span>
            <div className="min-w-0 text-left">
              <span className="text-[11px] font-black truncate block">
                {gpsDistance === null
                  ? 'กำลังตรวจจับพิกัดดาวเทียม...'
                  : isInRadius
                  ? `อยู่ในรัศมีลงเวลา (${gpsDistance} ม.) ✓ พร้อมบันทึก`
                  : `อยู่นอกพื้นที่ (${gpsDistance} ม.) ✕ ห้ามลงเวลา`}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/20 text-[9px] font-extrabold">
            <RefreshCw className="w-2.5 h-2.5" />
            <span>รีเฟรช</span>
          </div>
        </div>
      )}

      {/* Floating Bottom Mobile Navigation Bar (กรอบพื้นหลังลอยมุมโค้งมน) */}
      <nav className="floating-bottom-nav lg:hidden px-2 sm:px-4 py-2 flex items-center justify-around">
        {isAdmin ? (
          <>
            <button
              onClick={() => onSelectTab('admin-dashboard')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'admin-dashboard' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">ภาพรวม</span>
            </button>

            <button
              onClick={() => onSelectTab('admin-summary')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'admin-summary' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">สรุปเดือน</span>
            </button>

            <button
              onClick={() => onSelectTab('admin-map')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'admin-map' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">แผนที่</span>
            </button>

            <button
              onClick={onOpenUsersModal}
              className="flex-1 flex flex-col items-center py-1 text-slate-400 hover:text-purple-600 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">สมาชิก</span>
            </button>

            <button
              onClick={onOpenHolidaysModal}
              className="flex-1 flex flex-col items-center py-1 text-slate-400 hover:text-purple-600 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">วันหยุด</span>
            </button>

            <button
              onClick={onOpenConfigModal}
              className="flex-1 flex flex-col items-center py-1 text-slate-400 hover:text-purple-600 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">ตั้งค่า</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('teacher-dashboard')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'teacher-dashboard' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">แดชบอร์ด</span>
            </button>

            <button
              onClick={() => onSelectTab('home')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'home' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">ลงเวลา</span>
            </button>


            <button
              onClick={() => onClockAction('OUT')}
              className={`flex-1 flex flex-col items-center hover:scale-105 transition-transform cursor-pointer ${
                isOutsideArea ? 'text-rose-600' : 'text-amber-600'
              }`}
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 -mt-4 sm:-mt-5 rounded-2xl text-white flex items-center justify-center shadow-lg relative ${
                  isOutsideArea
                    ? 'bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-700/30 ring-2 ring-rose-300'
                    : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-700/30'
                }`}
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                {isOutsideArea && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 border border-white rounded-full flex items-center justify-center text-[7px] font-black">
                    ✕
                  </span>
                )}
              </div>
              <span
                className={`text-[8px] sm:text-[9px] font-bold mt-1 truncate ${
                  isOutsideArea ? 'text-rose-700' : 'text-amber-700'
                }`}
              >
                {isOutsideArea ? 'นอกพื้นที่' : 'ลงเวลากลับ'}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('teacher-report')}
              className={`flex-1 flex flex-col items-center py-1 transition-all cursor-pointer ${
                currentTab === 'teacher-report' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">รายงาน</span>
            </button>

            <button
              onClick={onOpenEditProfile}
              className="flex-1 flex flex-col items-center py-1 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-bold mt-0.5 truncate">โปรไฟล์</span>
            </button>
          </>
        )}
      </nav>
    </>
  );
};
