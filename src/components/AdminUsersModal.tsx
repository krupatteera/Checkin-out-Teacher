import React, { useState, useEffect } from 'react';
import { Users, X, RefreshCw, Trash2, Smartphone, ShieldCheck, UserPlus, Search, Phone, Briefcase } from 'lucide-react';
import { UserAccount } from '../types';
import { getAllUsersList, deleteUserAccount, resetUserMacAddress } from '../firebase';
import { Swal } from '../utils/sweetAlert';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  onOpenRegister
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.fullname.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.position && u.position.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col max-h-[92vh]">
        {/* Header with Pastel Purple Theme */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A78BFA] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">จัดการรายชื่อครูและบุคลากร</h3>
              <p className="text-xs text-purple-100">ตรวจสอบสถานะ, ผูกอุปกรณ์ MAC Address, จัดการสิทธิ์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-purple-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, ตำแหน่ง, Username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#8B5CF6] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-purple-50 hover:text-[#7C3AED] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> โหลดใหม่
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-purple-900/15 cursor-pointer"
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
              <p className="text-sm font-semibold">ไม่พบข้อมูลสมาชิกในระบบ</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-purple-50 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">ครู / บุคลากร</th>
                    <th className="px-4 py-3">ตำแหน่ง / สาระ</th>
                    <th className="px-4 py-3">บทบาท</th>
                    <th className="px-4 py-3">MAC Address ที่ผูกไว้</th>
                    <th className="px-4 py-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-4 py-3 flex items-center gap-3">
                        <img
                          src={
                            u.img ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              u.fullname
                            )}&background=8B5CF6&color=fff`
                          }
                          alt={u.fullname}
                          className="w-9 h-9 rounded-full object-cover border border-purple-200 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{u.fullname}</div>
                          <div className="text-[11px] text-slate-400">@{u.username}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{u.position || '-'}</div>
                        <div className="text-[11px] text-slate-400">{u.department || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.registeredMac ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-purple-900 bg-purple-50 px-2 py-1 rounded-lg w-fit border border-purple-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            {u.registeredMac}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">ยังไม่ผูกเครื่อง</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResetMac(u)}
                            className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                            title="รีเซ็ต MAC Address ให้ผูกเครื่องใหม่"
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="ลบผู้ใช้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
