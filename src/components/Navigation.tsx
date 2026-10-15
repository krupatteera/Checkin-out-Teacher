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
  X
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
  onOpenFaceScanner: (action: 'IN' | 'OUT') => void;
  onOpenLeaveModal: () => void;
  onOpenOfficialModal: () => void;
  onOpenConfigModal: () => void;
  onOpenUsersModal: () => void;
  onOpenEditProfile: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  user,
  config,
  currentTab,
  onSelectTab,
  onLogout,
  mobileMenuOpen,
  onCloseMobileMenu,
  onOpenFaceScanner,
  onOpenLeaveModal,
  onOpenOfficialModal,
  onOpenConfigModal,
  onOpenUsersModal,
  onOpenEditProfile
}) => {
  const isAdmin = user.role === 'admin';

  // iPhone Shortcut Icons definitions
  const shortcutIcons = [
    {
      id: 'in',
      name: 'สแกนเข้างาน',
      desc: 'Check-In',
      gradient: 'from-[#10b981] to-[#047857]',
      icon: Clock,
      onClick: () => {
        onCloseMobileMenu();
        onOpenFaceScanner('IN');
      }
    },
    {
      id: 'out',
      name: 'สแกนกลับ',
      desc: 'Check-Out',
      gradient: 'from-[#f59e0b] to-[#d97706]',
      icon: LogOut,
      onClick: () => {
        onCloseMobileMenu();
        onOpenFaceScanner('OUT');
      }
    },
    {
      id: 'leave',
      name: 'แจ้งลาหยุด',
      desc: 'Leave Request',
      gradient: 'from-[#3b82f6] to-[#1d4ed8]',
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
      gradient: 'from-[#8b5cf6] to-[#6d28d9]',
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
      gradient: 'from-[#ec4899] to-[#be185d]',
      icon: UserCheck,
      onClick: () => {
        onCloseMobileMenu();
        onOpenEditProfile();
      }
    },
    ...(isAdmin
      ? [
          {
            id: 'settings',
            name: 'ตั้งค่าระบบ',
            desc: 'Settings',
            gradient: 'from-[#0C7C82] to-[#35B4B0]',
            icon: Settings,
            onClick: () => {
              onCloseMobileMenu();
              onOpenConfigModal();
            }
          }
        ]
      : [])
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
                className="w-11 h-11 rounded-2xl object-cover shadow-md border-2 border-teal-100 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
                <School className="w-6 h-6" />
              </div>
            )}
            <div className="overflow-hidden">
              <h1 className="text-sm font-extrabold text-slate-800 truncate leading-tight">
                {config.orgName}
              </h1>
              <p className="text-[11px] text-teal-700 font-semibold truncate mt-0.5">
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
          {/* Main Navigation Menu */}
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2">
              เมนูการลงเวลา
            </div>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => {
                    onSelectTab('home');
                    onCloseMobileMenu();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                    currentTab === 'home'
                      ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-md shadow-teal-800/15'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>ลงเวลาปฏิบัติงาน (สแกนเข้า-ออก)</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      currentTab === 'home' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    สแกนใบหน้า
                  </span>
                </button>
              </li>
            </ul>
          </div>

          {isAdmin && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#0C7C82]" />
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
                        ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-md shadow-teal-800/15'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:translate-x-1'
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
                          ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-md shadow-teal-800/15'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:translate-x-1'
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
                          ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-md shadow-teal-800/15'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:translate-x-1'
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
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100/80 hover:translate-x-1 transition-all cursor-pointer group"
                    >
                      <Users className="w-4 h-4 text-[#0C7C82] transition-transform group-hover:scale-110" />
                      <span>จัดการสมาชิก/ครู</span>
                    </button>
                  </li>

                  <li>
                    <button
                      onClick={() => {
                        onCloseMobileMenu();
                        onOpenConfigModal();
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100/80 hover:translate-x-1 transition-all cursor-pointer group"
                    >
                      <Settings className="w-4 h-4 text-[#0C7C82] transition-transform group-hover:scale-110" />
                      <span>ตั้งค่าระบบ/ขอบเขต</span>
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
                          ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-md shadow-teal-800/15'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:translate-x-1'
                      }`}
                    >
                      <FileClock className="w-4 h-4 transition-transform group-hover:scale-110" />
                      <span>ประวัติระบบ (Logs)</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}

          {/* iPhone Shortcut Apps Panel */}
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-3 mb-2 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#35B4B0]" /> เมนูทางลัด iPhone Icons
            </div>
            <div className="grid grid-cols-3 gap-2.5 px-1">
              {shortcutIcons.map((sc) => {
                const IconComponent = sc.icon;
                return (
                  <button
                    key={sc.id}
                    onClick={sc.onClick}
                    className="flex flex-col items-center p-2 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group"
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
                  )}&background=0C7C82&color=fff`
                }
                alt={user.fullname}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="truncate">
                <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#0C7C82] transition-colors">
                  {user.fullname}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.position || 'ครูผู้สอน'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Floating Bottom Mobile Navigation Bar (กรอบพื้นหลังลอยมุมโค้งมน) */}
      <nav className="floating-bottom-nav lg:hidden px-4 py-2.5 flex items-center justify-around">
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center transition-all cursor-pointer ${
            currentTab === 'home' ? 'text-[#0C7C82] scale-105' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">หน้าหลัก</span>
        </button>

        <button
          onClick={() => onOpenFaceScanner('IN')}
          className="flex flex-col items-center text-emerald-600 hover:scale-105 transition-transform cursor-pointer"
        >
          <div className="w-10 h-10 -mt-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/30">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold mt-1 text-emerald-700">สแกนเข้า</span>
        </button>

        <button
          onClick={() => onOpenFaceScanner('OUT')}
          className="flex flex-col items-center text-amber-600 hover:scale-105 transition-transform cursor-pointer"
        >
          <div className="w-10 h-10 -mt-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-700/30">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold mt-1 text-amber-700">สแกนกลับ</span>
        </button>

        {isAdmin ? (
          <button
            onClick={() => onSelectTab('admin-dashboard')}
            className={`flex flex-col items-center transition-all cursor-pointer ${
              currentTab.startsWith('admin')
                ? 'text-[#0C7C82] scale-105'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">แอดมิน</span>
          </button>
        ) : (
          <button
            onClick={onOpenEditProfile}
            className="flex flex-col items-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <UserCheck className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">โปรไฟล์</span>
          </button>
        )}
      </nav>
    </>
  );
};
