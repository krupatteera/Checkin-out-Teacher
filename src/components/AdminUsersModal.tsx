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
  EyeOff,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Bluetooth
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

  // Preview face & credentials detail modal ("โมดูลดู")
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserAccount | null>(null);
  const [showDetailPassword, setShowDetailPassword] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

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
              u.registeredMac
                ? `<p class="text-purple-700 text-[11px] mt-1 font-mono font-medium">Bluetooth MAC: ${u.registeredMac}</p>`
                : ''
            }
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
      title: 'รีเซ็ต Bluetooth MAC Address?',
      html: `ต้องการปลดล็อคอุปกรณ์บลูทูธของ <b>${u.fullname}</b> (${u.username}) ใช่หรือไม่?<br><span class="text-xs text-slate-500">หลังจากรีเซ็ต ครูสามารถเข้าสู่ระบบจากเครื่องใหม่เพื่อผูก Bluetooth MAC Address ได้ทันที</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันรีเซ็ต',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED'
    });

    if (res.isConfirmed) {
      try {
        await resetUserMacAddress(u.id);
        Swal.fire('สำเร็จ', 'รีเซ็ต Bluetooth MAC Address สำเร็จแล้ว', 'success');
        fetchUsers();
        if (selectedUserForDetail && selectedUserForDetail.id === u.id) {
          setSelectedUserForDetail({ ...selectedUserForDetail, registeredMac: '' });
        }
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
        Swal.fire('สำเร็จ', 'ลบผู้ใช้งานเรียบร้อยแล้ว', 'success');
        fetchUsers();
      } catch (err: unknown) {
        Swal.fire('ผิดพลาด', err instanceof Error ? err.message : String(err), 'error');
      }
    }
  };

  // Filter users based on search & status tab
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullname.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase())) ||
      (u.registeredMac && u.registeredMac.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return u.status === 'PENDING';
    if (statusFilter === 'ACTIVE') return u.status === 'ACTIVE' || !u.status;
    if (statusFilter === 'INACTIVE') return u.status === 'INACTIVE';
    return true;
  });

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">จัดการรายชื่อครูและบุคลากร</h3>
              <p className="text-xs text-purple-100">
                อนุมัติสมาชิกใหม่ • ดู User & Password • ตรวจสอบ Bluetooth MAC & ชีวภาพ AI
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

        {/* Toolbar & Filters */}
        <div className="p-4 sm:p-6 border-b border-purple-50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-purple-50/30">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-purple-100 shadow-xs w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
              }`}
            >
              ทั้งหมด ({users.length})
            </button>

            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>รออนุมัติ</span>
              {pendingCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === 'PENDING' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              ใช้งานได้ ({users.filter((u) => u.status === 'ACTIVE' || !u.status).length})
            </button>

            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
              }`}
            >
              ระงับ ({users.filter((u) => u.status === 'INACTIVE').length})
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, username, Bluetooth MAC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-purple-100 text-xs focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <button
              onClick={fetchUsers}
              className="p-2 bg-white hover:bg-purple-50 text-slate-600 hover:text-[#7C3AED] rounded-xl border border-purple-100 shadow-xs cursor-pointer transition-colors"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onOpenRegister}
              className="px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มครูใหม่</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {loading && users.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7C3AED]" />
              <p className="text-xs">กำลังโหลดรายชื่อ...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">ไม่พบรายชื่อครูและบุคลากร</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-purple-100 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-purple-50/70 text-slate-600 font-bold border-b border-purple-100 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">ภาพใบหน้า AI</th>
                    <th className="px-4 py-3">ตำแหน่ง / สาระ</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Bluetooth className="w-3.5 h-3.5 text-purple-600" />
                        <span>Bluetooth MAC</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {filteredUsers.map((u) => {
                    const isPending = u.status === 'PENDING';

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-purple-50/40 transition-colors ${
                          isPending ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Name & Username */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{u.fullname}</div>
                          <div className="text-[11px] text-purple-700 font-mono">@{u.username}</div>
                          {u.phone && (
                            <div className="text-[10px] text-slate-400 mt-0.5">โทร: {u.phone}</div>
                          )}
                        </td>

                        {/* Face Snapshot & Biometrics badge */}
                        <td className="px-4 py-3">
                          {u.img ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={u.img}
                                alt={u.fullname}
                                className="w-10 h-10 rounded-xl object-cover border border-purple-200 shadow-xs"
                              />
                              {u.faceBiometrics && (
                                <div>
                                  <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> {u.faceBiometrics.confidence}%
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    {u.faceBiometrics.quality}
                                  </div>
                                </div>
                              )}
                            </div>
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

                        {/* Bluetooth MAC Address */}
                        <td className="px-4 py-3">
                          {u.registeredMac ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg w-fit border border-purple-200">
                              <Bluetooth className="w-3.5 h-3.5 text-purple-600" />
                              <span>{u.registeredMac}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">ยังไม่ผูก</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* APPROVE BUTTON (Visible for Pending) */}
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

                            {/* View Detail button ("โมดูลดู" แสดง User & Password) */}
                            <button
                              onClick={() => {
                                setSelectedUserForDetail(u);
                                setShowDetailPassword(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white font-bold text-xs flex items-center gap-1 border border-purple-200 transition-colors cursor-pointer"
                              title="ดู User, Password และรายละเอียดชีวภาพ AI"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูข้อมูล</span>
                            </button>

                            {/* Reset Bluetooth MAC */}
                            <button
                              onClick={() => handleResetMac(u)}
                              className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                              title="รีเซ็ต Bluetooth MAC Address ให้ผูกเครื่องใหม่"
                            >
                              <Bluetooth className="w-4 h-4" />
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

        {/* ======================================================== */}
        {/* โมดูลดู: แสดงข้อมูลครู พร้อม USER และ PASSWORD            */}
        {/* ======================================================== */}
        {selectedUserForDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-xs animate-fadeIn">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#7C3AED]" /> ข้อมูลผู้ใช้งานและรหัสผ่าน (User & Password)
                </h4>
                <button
                  onClick={() => setSelectedUserForDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card Summary */}
              <div className="mt-4 flex flex-col items-center">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-purple-300 shadow-md mb-2 bg-purple-50">
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

                <h5 className="font-bold text-slate-900 text-lg text-center">
                  {selectedUserForDetail.fullname}
                </h5>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-purple-700 font-medium">
                    {selectedUserForDetail.position || 'ครูผู้สอน'}
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-xs text-slate-500">
                    {selectedUserForDetail.department || 'ไม่ระบุกลุ่มสาระ'}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="mt-2">
                  {selectedUserForDetail.status === 'PENDING' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-amber-100 text-amber-800 border border-amber-300">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> รออนุมัติการใช้งาน (Pending)
                    </span>
                  ) : selectedUserForDetail.status === 'INACTIVE' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-rose-100 text-rose-700 border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> ระงับการใช้งาน
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> อนุมัติใช้งานแล้ว (Active)
                    </span>
                  )}
                </div>

                {/* ======================================================== */}
                {/* DEDICATED USER & PASSWORD CREDENTIALS BOX                */}
                {/* ======================================================== */}
                <div className="w-full mt-4 p-4 bg-gradient-to-br from-purple-50 via-indigo-50/50 to-purple-50 rounded-2xl border-2 border-purple-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#7C3AED] pb-1.5 border-b border-purple-200/70">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#7C3AED]" /> ข้อมูลการเข้าสู่ระบบ (Credentials)
                    </span>
                    <span className="text-[10px] font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                      สำหรับผู้ดูแลระบบ
                    </span>
                  </div>

                  {/* USERNAME (User) */}
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Username (ชื่อผู้ใช้)
                      </span>
                      <span className="font-mono font-bold text-base text-purple-950">
                        {selectedUserForDetail.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedUserForDetail.username, 'user')}
                      className="px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-lg border border-purple-200 flex items-center gap-1 cursor-pointer transition-colors"
                      title="คัดลอก Username"
                    >
                      {copiedField === 'user' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-purple-600" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* PASSWORD */}
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Password (รหัสผ่าน)
                      </span>
                      <span className="font-mono font-bold text-base text-slate-900 tracking-wide">
                        {showDetailPassword
                          ? selectedUserForDetail.password || '(ไม่มีข้อมูลรหัสผ่าน)'
                          : '••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowDetailPassword(!showDetailPassword)}
                        className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors"
                        title={showDetailPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      >
                        {showDetailPassword ? (
                          <EyeOff className="w-4 h-4 text-purple-700" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {selectedUserForDetail.password && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedUserForDetail.password!, 'pass')}
                          className="px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-lg border border-purple-200 flex items-center gap-1 cursor-pointer transition-colors"
                          title="คัดลอกรหัสผ่าน"
                        >
                          {copiedField === 'pass' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-purple-600" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bluetooth Device MAC Address Card */}
                <div className="w-full mt-3 p-3 bg-purple-50/60 rounded-2xl border border-purple-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-100 rounded-xl text-purple-700">
                      <Bluetooth className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Bluetooth MAC Address</span>
                        {selectedUserForDetail.registeredMac && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-bold">
                            ผูกเครื่องแล้ว
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-purple-900 text-xs font-semibold mt-0.5">
                        {selectedUserForDetail.registeredMac || 'ยังไม่ได้ผูกอุปกรณ์บลูทูธ'}
                      </div>
                    </div>
                  </div>

                  {selectedUserForDetail.registeredMac && (
                    <button
                      type="button"
                      onClick={() => handleResetMac(selectedUserForDetail)}
                      className="px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 rounded-xl border border-purple-200 cursor-pointer transition-colors"
                      title="รีเซ็ต Bluetooth MAC ให้ผูกเครื่องใหม่"
                    >
                      รีเซ็ตเครื่อง
                    </button>
                  )}
                </div>

                {/* AI Biometrics Card */}
                {selectedUserForDetail.faceBiometrics && (
                  <div className="w-full mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1 text-slate-700">
                    <div className="flex items-center justify-between font-bold text-[#7C3AED]">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> ฐานข้อมูลชีวภาพใบหน้า AI
                      </span>
                      <span className="text-[10px] bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">
                        ความมั่นใจ {selectedUserForDetail.faceBiometrics.confidence}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                      {selectedUserForDetail.faceBiometrics.aiSummary ||
                        selectedUserForDetail.faceBiometrics.descriptor}
                    </p>
                  </div>
                )}

                {/* Action buttons in detail modal */}
                <div className="w-full mt-4 flex items-center gap-2">
                  {selectedUserForDetail.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        const target = selectedUserForDetail;
                        setSelectedUserForDetail(null);
                        handleApprove(target);
                      }}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> ยืนยันอนุมัติการใช้งาน
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedUserForDetail(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer text-center"
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
