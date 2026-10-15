import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  RefreshCw,
  Trash2,
  Smartphone,
  ShieldCheck,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
  AlertCircle
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  getAllUsersList,
  deleteUserAccount,
  resetUserMacAddress,
  approveUserAccount,
  rejectUserAccount
} from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
  currentAdminUsername?: string;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  onOpenRegister,
  currentAdminUsername = 'admin'
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Preview face & biometrics detail modal
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserAccount | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await getAllUsersList();
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  // Handle Approve User
  const handleApprove = async (u: UserAccount) => {
    const res = await Swal.fire({
      title: 'อนุมัติการใช้งาน?',
      html: `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>คุณต้องการอนุมัติบัญชีและฐานข้อมูลใบหน้าของ <b>${u.fullname}</b> (@${u.username}) ใช่หรือไม่?</p>
          <div class="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
            <p class="font-semibold text-purple-900">ตำแหน่ง: ${u.position || '-'}</p>
            <p class="text-slate-500 text-[11px]">กลุ่มสาระ: ${u.department || '-'}</p>
            ${
              u.faceBiometrics
                ? `<p class="text-emerald-700 text-[11px] mt-1 font-medium">✓ AI Biometric: ผ่านเกณฑ์ (${u.faceBiometrics.confidence}%)</p>`
                : ''
            }
          </div>
          <p class="text-[11px] text-slate-500">*หลังจากอนุมัติ ครูสามารถเข้าสู่ระบบและลงเวลาปฏิบัติงานได้ทันที</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันอนุมัติ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED'
    });

    if (res.isConfirmed) {
      try {
        await approveUserAccount(u.id, currentAdminUsername);
        Swal.fire({
          title: 'อนุมัติสำเร็จ!',
          text: `อนุมัติบัญชี ${u.fullname} เรียบร้อยแล้ว ครูสามารถเข้าสู่ระบบได้ทันที`,
          icon: 'success',
          confirmButtonColor: '#7C3AED'
        });
        fetchUsers();
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  // Handle Reject User
  const handleReject = async (u: UserAccount) => {
    const res = await Swal.fire({
      title: 'ระงับ/ปฏิเสธการใช้งาน?',
      text: `ต้องการระงับการใช้งานบัญชี ${u.fullname} (${u.username}) หรือไม่`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ระงับการใช้งาน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF5350'
    });

    if (res.isConfirmed) {
      try {
        await rejectUserAccount(u.id, currentAdminUsername, 'ผู้ดูแลระบบไม่อนุมัติ');
        Swal.fire('สำเร็จ', `ระงับบัญชี ${u.username} เรียบร้อยแล้ว`, 'success');
        fetchUsers();
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  const handleResetMac = async (u: UserAccount) => {
    const res = await Swal.fire({
      title: 'รีเซ็ต MAC Address?',
      html: `ต้องการปลดล็อคอุปกรณ์ของ <b>${u.fullname}</b> (${u.username}) ใช่หรือไม่?<br><span class="text-xs text-slate-500">หลังจากรีเซ็ต ครูสามารถเข้าสู่ระบบจากเครื่องใหม่เพื่อผูกอุปกรณ์ได้ทันที</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันรีเซ็ต',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED'
    });

    if (res.isConfirmed) {
      try {
        await resetUserMacAddress(u.id);
        Swal.fire('สำเร็จ', 'รีเซ็ต MAC Address สำเร็จแล้ว', 'success');
        fetchUsers();
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  const handleDelete = async (u: UserAccount) => {
    const res = await Swal.fire({
      title: 'ยืนยันการลบสมาชิก?',
      html: `คุณต้องการลบผู้ใช้งาน <b>${u.fullname}</b> (${u.username}) ออกจากระบบใช่หรือไม่?<br><span class="text-xs text-rose-500 font-semibold">*ข้อมูลการใช้งานจะถูกลบและไม่สามารถกู้คืนได้</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF5350'
    });

    if (res.isConfirmed) {
      try {
        await deleteUserAccount(u.id);
        Swal.fire('ลบสำเร็จ', `ลบผู้ใช้งาน ${u.username} เรียบร้อยแล้ว`, 'success');
        fetchUsers();
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  if (!isOpen) return null;

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQuery =
      u.fullname.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.position && u.position.toLowerCase().includes(q));

    if (!matchQuery) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return u.status === 'PENDING';
    if (statusFilter === 'ACTIVE') return u.status === 'ACTIVE' || (!u.status && u.role === 'admin');
    if (statusFilter === 'INACTIVE') return u.status === 'INACTIVE';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[94vh]">
        {/* Header with Pastel Purple Theme */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">จัดการรายชื่อครูและบุคลากร</h3>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-extrabold text-xs animate-bounce shadow-xs">
                    รออนุมัติ {pendingCount} คน
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-100">
                อนุมัติฐานข้อมูลใบหน้า AI, ตรวจสอบสถานะ, ผูกอุปกรณ์ MAC Address, จัดการสิทธิ์
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

        {/* Toolbar & Status Tabs */}
        <div className="p-4 bg-slate-50 border-b border-purple-50 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-purple-100 w-full md:w-auto overflow-x-auto text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>รออนุมัติ</span>
              {pendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    statusFilter === 'PENDING' ? 'bg-white text-amber-600' : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              อนุมัติแล้ว ({users.filter((u) => u.status === 'ACTIVE' || (!u.status && u.role === 'admin')).length})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              ระงับ ({users.filter((u) => u.status === 'INACTIVE').length})
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative w-full md:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, ตำแหน่ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#8B5CF6] bg-white"
              />
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED] transition-colors cursor-pointer shrink-0"
              title="โหลดใหม่"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="px-3 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-purple-900/15 cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" /> เพิ่มครูใหม่
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7C3AED]" />
              <p className="text-xs font-semibold">กำลังโหลดข้อมูลสมาชิก...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">ไม่พบข้อมูลสมาชิกในหมวดหมู่นี้</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-purple-50 rounded-2xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">ฐานข้อมูลใบหน้า (AI)</th>
                    <th className="px-4 py-3">ตำแหน่ง / สาระ</th>
                    <th className="px-4 py-3">สถานะบัญชี</th>
                    <th className="px-4 py-3">MAC Address</th>
                    <th className="px-4 py-3 text-right">การจัดการ & อนุมัติ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => {
                    const isPending = u.status === 'PENDING';
                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors ${
                          isPending ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-purple-50/30'
                        }`}
                      >
                        {/* User Profile */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative group cursor-pointer" onClick={() => setSelectedUserForDetail(u)}>
                              <img
                                src={
                                  u.img ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    u.fullname
                                  )}&background=8B5CF6&color=fff`
                                }
                                alt={u.fullname}
                                className={`w-10 h-10 rounded-full object-cover border-2 shrink-0 ${
                                  isPending ? 'border-amber-400 shadow-sm' : 'border-purple-200'
                                }`}
                              />
                              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-4 h-4" />
                              </div>
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                <span>{u.fullname}</span>
                                {u.role === 'admin' && (
                                  <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-bold">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* AI Face Biometrics Badge */}
                        <td className="px-4 py-3">
                          {u.faceBiometrics ? (
                            <button
                              onClick={() => setSelectedUserForDetail(u)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7C3AED] font-semibold text-[11px] border border-purple-200 transition-colors cursor-pointer text-left"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                              <span>AI ตรวจแล้ว ({u.faceBiometrics.confidence}%)</span>
                            </button>
                          ) : u.img ? (
                            <span className="text-slate-500 text-[11px] flex items-center gap-1">
                              <span>มีภาพใบหน้า</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">ไม่มีภาพ</span>
                          )}
                        </td>

                        {/* Position / Dept */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700">{u.position || '-'}</div>
                          <div className="text-[11px] text-slate-400">{u.department || '-'}</div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>รออนุมัติ (Pending)</span>
                            </span>
                          ) : u.status === 'INACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>ระงับการใช้งาน</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>อนุมัติแล้ว (Active)</span>
                            </span>
                          )}
                        </td>

                        {/* MAC Address */}
                        <td className="px-4 py-3">
                          {u.registeredMac ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg w-fit border border-purple-200">
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span>{u.registeredMac}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">ยังไม่ผูก</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* APPROVE BUTTON (Visible for Pending or Inactive) */}
                            {isPending && (
                              <button
                                onClick={() => handleApprove(u)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                                title="อนุมัติสมาชิกให้เข้าใช้งาน"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> อนุมัติ
                              </button>
                            )}

                            {u.status === 'INACTIVE' && (
                              <button
                                onClick={() => handleApprove(u)}
                                className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs cursor-pointer"
                                title="เปิดใช้งานบัญชีอีกครั้ง"
                              >
                                เปิดใช้งาน
                              </button>
                            )}

                            {/* View Detail button */}
                            <button
                              onClick={() => setSelectedUserForDetail(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-pointer"
                              title="ดูรายละเอียดและข้อมูลใบหน้า AI"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Reset MAC */}
                            <button
                              onClick={() => handleResetMac(u)}
                              className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                              title="รีเซ็ต MAC Address ให้ผูกเครื่องใหม่"
                            >
                              <Smartphone className="w-4 h-4" />
                            </button>

                            {/* Reject / Delete */}
                            {isPending ? (
                              <button
                                onClick={() => handleReject(u)}
                                className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                                title="ปฏิเสธคำขอ"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="ลบผู้ใช้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Detail for User Face & AI Biometrics */}
        {selectedUserForDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fadeIn">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 p-6">
              <div className="flex items-center justify-between pb-3 border-b border-purple-50">
                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7C3AED]" /> ข้อมูลใบหน้าและชีวภาพ AI
                </h4>
                <button
                  onClick={() => setSelectedUserForDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-col items-center">
                <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-2 border-purple-300 shadow-md mb-3">
                  <img
                    src={
                      selectedUserForDetail.img ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedUserForDetail.fullname
                      )}&background=8B5CF6&color=fff`
                    }
                    alt={selectedUserForDetail.fullname}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h5 className="font-bold text-slate-900 text-base">{selectedUserForDetail.fullname}</h5>
                <p className="text-xs text-slate-500 font-mono">@{selectedUserForDetail.username}</p>

                {/* Biometrics Card */}
                <div className="w-full mt-4 p-3 bg-purple-50/70 rounded-2xl border border-purple-200 text-xs space-y-1.5 text-slate-700">
                  <div className="flex items-center justify-between font-bold text-[#7C3AED]">
                    <span>ผลการวิเคราะห์ AI Biometric</span>
                    <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                      {selectedUserForDetail.faceBiometrics?.quality || 'GOOD'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {selectedUserForDetail.faceBiometrics?.aiSummary ||
                      selectedUserForDetail.faceBiometrics?.descriptor ||
                      'ตรวจพบโครงสร้างใบหน้าสำหรับใช้ในการสแกนลงเวลา'}
                  </p>
                  <div className="text-[10px] text-slate-400 pt-1">
                    คะแนนความมั่นใจ AI:{' '}
                    <b className="text-purple-700 font-bold">
                      {selectedUserForDetail.faceBiometrics?.confidence || 90}%
                    </b>
                  </div>
                </div>

                {/* Action button in detail modal */}
                <div className="w-full mt-5 flex items-center gap-2">
                  {selectedUserForDetail.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        const target = selectedUserForDetail;
                        setSelectedUserForDetail(null);
                        handleApprove(target);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> อนุมัติการใช้งาน
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUserForDetail(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
