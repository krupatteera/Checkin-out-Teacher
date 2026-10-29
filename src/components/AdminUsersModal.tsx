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
  Bluetooth,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

  // Preview face & teacher detail modal
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

  const handleExportExcel = () => {
    if (users.length === 0) {
      Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลรายชื่อครูและบุคลากรสำหรับส่งออก', 'info');
      return;
    }

    const dataToExport = filteredUsers.length > 0 ? filteredUsers : users;

    const rows = dataToExport.map((u, index) => ({
      'ลำดับ': index + 1,
      'ชื่อ-นามสกุล': u.fullname || '-',
      'ชื่อผู้ใช้งาน (User)': u.username || u.id || '-',
      'รหัสผ่าน (Password)': u.password || '-',
      'ตำแหน่ง': u.position || '-',
      'สังกัด/กลุ่มสาระ': u.department || '-',
      'สิทธิ์การใช้งาน': u.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ครู/บุคลากร',
      'สถานะบัญชี': u.status === 'PENDING' ? 'รออนุมัติ' : u.status === 'INACTIVE' ? 'ระงับการใช้งาน' : 'ใช้งานได้ปกติ',
      'Bluetooth MAC Address': u.registeredMac || '-',
      'วันที่ลงทะเบียน': u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 8 },  // ลำดับ
      { wch: 28 }, // ชื่อ-นามสกุล
      { wch: 20 }, // User
      { wch: 18 }, // Password
      { wch: 20 }, // ตำแหน่ง
      { wch: 24 }, // สังกัด/กลุ่มสาระ
      { wch: 20 }, // สิทธิ์การใช้งาน
      { wch: 16 }, // สถานะบัญชี
      { wch: 24 }, // Bluetooth MAC Address
      { wch: 18 }  // วันที่ลงทะเบียน
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายชื่อครูและบุคลากร');

    const todayDate = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `รายชื่อครูและบุคลากร_${todayDate}.xlsx`);

    Swal.fire({
      title: 'ส่งออกไฟล์สำเร็จ!',
      text: `ดาวน์โหลดไฟล์ Excel รายชื่อครูและบุคลากรเรียบร้อยแล้ว (${rows.length} รายการ)`,
      icon: 'success',
      confirmButtonColor: '#7C3AED'
    });
  };

  // Filter users based on search & status tab
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullname.toLowerCase().includes(search.toLowerCase()) ||
      (u.username ? u.username.toLowerCase().includes(search.toLowerCase()) : false) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase())) ||
      (u.registeredMac && u.registeredMac.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return u.status === 'PENDING';
    if (statusFilter === 'ACTIVE') return u.status === 'ACTIVE' || !u.status;
    if (statusFilter === 'INACTIVE') return u.status === 'INACTIVE';
    return true;
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedUserForDetail) {
          setSelectedUserForDetail(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedUserForDetail, onClose]);

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn"
    >
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
                อนุมัติสมาชิกใหม่ &bull; จัดการ User & Password และ Bluetooth MAC
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
                placeholder="ค้นหาชื่อ-นามสกุล, ตำแหน่ง, Bluetooth MAC..."
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
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              title="ส่งออกรายชื่อครูและบุคลากรเป็นไฟล์ Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ส่งออก Excel</span>
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
                    <th className="px-4 py-3">User & Password</th>
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
                        {/* Name and Avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-purple-100 border border-purple-200 shrink-0 flex items-center justify-center">
                              {u.img ? (
                                <img src={u.img} alt={u.fullname} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-[#7C3AED]">{u.fullname.slice(0, 1)}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.fullname}</div>
                              {u.phone && (
                                <div className="text-[10px] text-slate-400">โทร: {u.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Username & Password */}
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 w-fit text-xs">
                            @{u.username || u.id}
                          </div>
                          {u.password && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Pass: <span className="text-slate-800 font-semibold">{u.password}</span>
                            </div>
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

                            {/* View Detail button */}
                            <button
                              onClick={() => setSelectedUserForDetail(u)}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white font-bold text-xs flex items-center gap-1 border border-purple-200 transition-colors cursor-pointer"
                              title="ดูรายละเอียดข้อมูลครูและชีวภาพ AI"
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

        {/* Modal Footer with Close Button */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-purple-100 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 font-medium">
            แสดง {filteredUsers.length} จากทั้งหมด {users.length} รายชื่อ
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
          >
            <X className="w-4 h-4 text-slate-600" />
            <span>ปิดหน้าต่าง</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* โมดูลดู: แสดงข้อมูลครู พร้อม USER และ PASSWORD            */}
        {/* ======================================================== */}
        {selectedUserForDetail && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedUserForDetail(null);
            }}
            className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/85 backdrop-blur-xs animate-fadeIn"
          >
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#7C3AED]" /> ข้อมูลบัญชีครูและบุคลากร
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
                {selectedUserForDetail.phone && (
                  <p className="text-xs text-slate-500 mt-1">โทร: {selectedUserForDetail.phone}</p>
                )}

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

                {/* Account Credentials Card (User & Password) */}
                <div className="w-full mt-3 p-3 bg-purple-50/70 rounded-2xl border border-purple-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <KeyRound className="w-4 h-4 text-[#7C3AED]" />
                    <span>ข้อมูลเข้าสู่ระบบ (User & Password)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">ชื่อผู้ใช้งาน (Username)</span>
                      <span className="font-bold text-purple-900 font-mono text-xs">@{selectedUserForDetail.username || selectedUserForDetail.id}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-medium">รหัสผ่าน (Password)</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{selectedUserForDetail.password || 'ไม่ได้กำหนด'}</span>
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
