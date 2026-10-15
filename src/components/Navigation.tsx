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
          id: 'admin-logs',
          name: 'ประวัติระบบ',
          desc: 'System Logs',
          gradient: 'from-[#EC4899] to-[#BE185D]',
          icon: FileClock,
          onClick: () => {
            onCloseMobileMenu();
            onSelectTab('admin-logs');
          }
        }
      ]
    : [
        {
          id: 'in',
          name: 'สแกนเข้างาน',
          desc: 'Check-In',
          gradient: 'from-[#10B981] to-[#047857]',
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
          gradient: 'from-[#F59E0B] to-[#D97706]',
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
                        ? 'bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white shadow-md shadow-purple-800/20'
                        : 'text-slate-600 hover:bg-purple-50/60 hover:text-purple-700 hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 transition-transform group-hover:scale-110" />
                      <span>ลงเวลาปฏิบัติงาน (สแกนเข้า-ออก)</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        currentTab === 'home' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      สแกนใบหน้า
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

      {/* Floating Bottom Mobile Navigation Bar (กรอบพื้นหลังลอยมุมโค้งมน) */}
      <nav className="floating-bottom-nav lg:hidden px-4 py-2.5 flex items-center justify-around">
        {isAdmin ? (
          <>
            <button
              onClick={() => onSelectTab('admin-dashboard')}
              className={`flex flex-col items-center transition-all cursor-pointer ${
                currentTab === 'admin-dashboard' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">ภาพรวม</span>
            </button>

            <button
              onClick={() => onSelectTab('admin-summary')}
              className={`flex flex-col items-center transition-all cursor-pointer ${
                currentTab === 'admin-summary' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">สรุปเดือน</span>
            </button>

            <button
              onClick={() => onSelectTab('admin-map')}
              className={`flex flex-col items-center transition-all cursor-pointer ${
                currentTab === 'admin-map' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">แผนที่</span>
            </button>

            <button
              onClick={onOpenUsersModal}
              className="flex flex-col items-center text-slate-400 hover:text-purple-600 transition-all cursor-pointer"
            >
              <Users className="w-5 h-5 text-purple-600" />
              <span className="text-[10px] font-bold mt-0.5">สมาชิก</span>
            </button>

            <button
              onClick={onOpenConfigModal}
              className="flex flex-col items-center text-slate-400 hover:text-purple-600 transition-all cursor-pointer"
            >
              <Settings className="w-5 h-5 text-purple-600" />
              <span className="text-[10px] font-bold mt-0.5">ตั้งค่า</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('home')}
              className={`flex flex-col items-center transition-all cursor-pointer ${
                currentTab === 'home' ? 'text-[#7C3AED] scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">ลงเวลา</span>
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

            <button
              onClick={onOpenEditProfile}
              className="flex flex-col items-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <UserCheck className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-0.5">โปรไฟล์</span>
            </button>
          </>
        )}
      </nav>
    </>
  );
};
