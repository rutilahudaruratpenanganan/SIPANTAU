import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Save, 
  Building, 
  ShieldCheck, 
  Briefcase,
  CheckCircle2,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { Personel, PejabatConfig, Role } from '../types';

interface ModalPersonelProps {
  isOpen: boolean;
  onClose: () => void;
  personelList: Personel[];
  pejabatConfig: PejabatConfig;
  currentRole: Role;
  currentUser: Personel;
  onSwitchUser: (personel: Personel) => void;
  onUpdatePejabat: (newPejabat: PejabatConfig) => void;
  onAddPersonel: (personel: Omit<Personel, 'id'>) => void;
  onUpdatePersonel: (id: string, updated: Partial<Personel>) => void;
  onDeletePersonel: (id: string) => void;
}

export const ModalPersonel: React.FC<ModalPersonelProps> = ({
  isOpen,
  onClose,
  personelList,
  pejabatConfig,
  currentRole,
  currentUser,
  onSwitchUser,
  onUpdatePejabat,
  onAddPersonel,
  onUpdatePersonel,
  onDeletePersonel,
}) => {
  // Active sub-tab: 'struktural' | 'tim'
  const [activeSubTab, setActiveSubTab] = useState<'struktural' | 'tim'>('struktural');

  // Pejabat form state
  const [pejabat, setPejabat] = useState<PejabatConfig>(pejabatConfig);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Sync state if pejabatConfig updates
  useEffect(() => {
    setPejabat(pejabatConfig);
  }, [pejabatConfig]);

  // Add personel form state
  const [isAddingPersonel, setIsAddingPersonel] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newNip, setNewNip] = useState('');
  const [newJabatan, setNewJabatan] = useState('Staf Pengawasan dan Pengendalian Perumahan');
  const [newPeran, setNewPeran] = useState<Role>('staf');
  const [newEmail, setNewEmail] = useState('');

  // Edit existing personel
  const [editingPersonelId, setEditingPersonelId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editPeran, setEditPeran] = useState<Role>('staf');

  // Delete confirmation state (in-app, no window.confirm)
  const [personelToDelete, setPersonelToDelete] = useState<Personel | null>(null);

  if (!isOpen) return null;

  const handleSavePejabat = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePejabat(pejabat);
    setSaveSuccessMsg('Data penandatangan dan pejabat struktural berhasil disimpan. Akses pengguna aktif langsung diperbarui!');
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  const handleAddPersonelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) return;

    onAddPersonel({
      nama: newNama.trim(),
      nip: newNip.trim() || undefined,
      jabatan: newJabatan.trim(),
      peran: newPeran,
      email: newEmail.trim() || undefined,
      isKetuaTim: newPeran === 'ketua_tim',
    });

    setSaveSuccessMsg(`Personel baru ${newNama} berhasil ditambahkan dan akses pengguna aktif langsung beralih.`);
    setTimeout(() => setSaveSuccessMsg(''), 3500);

    setNewNama('');
    setNewNip('');
    setNewEmail('');
    setIsAddingPersonel(false);
  };

  const startEditPersonel = (p: Personel) => {
    setEditingPersonelId(p.id);
    setEditNama(p.nama);
    setEditNip(p.nip || '');
    setEditJabatan(p.jabatan);
    setEditPeran(p.peran);
  };

  const saveEditPersonel = (id: string) => {
    const isKetua = editPeran === 'ketua_tim';
    const updated: Partial<Personel> = {
      nama: editNama.trim(),
      nip: editNip.trim() || undefined,
      jabatan: editJabatan.trim(),
      peran: editPeran,
      isKetuaTim: isKetua,
    };
    onUpdatePersonel(id, updated);
    setEditingPersonelId(null);
    setSaveSuccessMsg(`Data ${editNama} diperbarui. Akses pengguna aktif langsung diperbarui.`);
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Kelola Personel Tim & Penandatangan Naskah Dinas
            </h2>
            <p className="text-xs text-slate-400">
              Konfigurasi pejabat penandatangan, ketua tim pendisposisi, dan personel staf pelaksana
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0">
          <button
            onClick={() => setActiveSubTab('struktural')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeSubTab === 'struktural'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Pejabat & Penandatangan (Kadis / Kabid / Ketua Tim)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('tim')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeSubTab === 'tim'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Personel Tim ({personelList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* TAB 1: PEJABAT STRUKTURAL */}
          {activeSubTab === 'struktural' && (
            <form onSubmit={handleSavePejabat} className="space-y-6">
              
              {/* 1. KEPALA DINAS (Penandatangan TTE PESONA) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    1. Kepala Dinas (Penandatangan Surat / Pengesahan PESONA)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={pejabat.kepalaDinas.nama}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaDinas: { ...pejabat.kepalaDinas, nama: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NIP (Nomor Induk Pegawai)</label>
                    <input
                      type="text"
                      value={pejabat.kepalaDinas.nip}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaDinas: { ...pejabat.kepalaDinas, nip: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Jabatan Resmi</label>
                    <input
                      type="text"
                      value={pejabat.kepalaDinas.jabatan}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaDinas: { ...pejabat.kepalaDinas, jabatan: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Instansi / Dinas</label>
                    <input
                      type="text"
                      value={pejabat.kepalaDinas.instansi}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaDinas: { ...pejabat.kepalaDinas, instansi: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 2. KEPALA BIDANG PERUMAHAN */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Briefcase className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    2. Kepala Bidang Perumahan (Atasan Bidang / Asistensi Naskah)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={pejabat.kepalaBidang.nama}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaBidang: { ...pejabat.kepalaBidang, nama: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NIP (Nomor Induk Pegawai)</label>
                    <input
                      type="text"
                      value={pejabat.kepalaBidang.nip}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        kepalaBidang: { ...pejabat.kepalaBidang, nip: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. KETUA TIM WASDAL PERUMAHAN (ATASAN LANGSUNG) */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3">
                <div className="flex items-center gap-2 border-b border-purple-200 pb-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-purple-950 text-xs">
                    3. Ketua Tim Pengawasan dan Pengendalian Perumahan (Atasan Langsung Pendisposisi Surat)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={pejabat.ketuaTim.nama}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        ketuaTim: { ...pejabat.ketuaTim, nama: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">NIP (Nomor Induk Pegawai)</label>
                    <input
                      type="text"
                      value={pejabat.ketuaTim.nip}
                      onChange={(e) => setPejabat({
                        ...pejabat,
                        ketuaTim: { ...pejabat.ketuaTim, nip: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-purple-700">
                  * Mengubah nama Ketua Tim di sini akan langsung memperbarui akses pengguna aktif Ketua Tim secara otomatis.
                </p>
              </div>

              {/* Submit Pejabat Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan & Perbarui Akses Aktif</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: PERSONEL TIM (STAF & KETUA TIM) */}
          {activeSubTab === 'tim' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">
                    Daftar Personel Tim Pengawasan & Pengendalian Perumahan
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Personel yang berhak menerima disposisi dan menindaklanjuti naskah dinas
                  </p>
                </div>
                {!isAddingPersonel && (
                  <button
                    onClick={() => setIsAddingPersonel(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Tambah Personel</span>
                  </button>
                )}
              </div>

              {/* Form Tambah Personel */}
              {isAddingPersonel && (
                <form onSubmit={handleAddPersonelSubmit} className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
                  <div className="font-bold text-blue-900 text-xs">Form Registrasi Personel Baru</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Nama Lengkap & Panggilan <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={newNama}
                        onChange={(e) => setNewNama(e.target.value)}
                        placeholder="Contoh: Chafidz / Eva Nurmalia, S.AP."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">NIP (Opsional)</label>
                      <input
                        type="text"
                        value={newNip}
                        onChange={(e) => setNewNip(e.target.value)}
                        placeholder="19920321 201503 2 004"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Jabatan / Tugas</label>
                      <input
                        type="text"
                        value={newJabatan}
                        onChange={(e) => setNewJabatan(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">Hak Akses / Peran</label>
                      <select
                        value={newPeran}
                        onChange={(e) => setNewPeran(e.target.value as Role)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="staf">Staf Pelaksana</option>
                        <option value="ketua_tim">Ketua Tim (Atasan Pendisposisi)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingPersonel(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-medium"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
                    >
                      Simpan & Jadikan Pengguna Aktif
                    </button>
                  </div>
                </form>
              )}

              {/* In-App Delete Confirmation Banner */}
              {personelToDelete && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0 mt-0.5">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-rose-900 text-xs">
                        Konfirmasi Penghapusan Personel
                      </div>
                      <p className="text-xs text-rose-800">
                        Apakah Anda yakin ingin menghapus data personel <strong>"{personelToDelete.nama}"</strong> ({personelToDelete.jabatan})?
                      </p>
                      <p className="text-[11px] text-rose-600">
                        • Akun personel ini akan dihapus dari daftar penugasan disposisi baru.
                        <br />
                        • Riwayat naskah dinas dan arsip disposisi yang pernah ditugaskan sebelumnya tetap tersimpan aman.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200">
                    <button
                      type="button"
                      onClick={() => setPersonelToDelete(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetName = personelToDelete.nama;
                        onDeletePersonel(personelToDelete.id);
                        setPersonelToDelete(null);
                        setSaveSuccessMsg(`Data personel "${targetName}" berhasil dihapus.`);
                        setTimeout(() => setSaveSuccessMsg(''), 3500);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Personel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* List Personel */}
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {personelList.map((p) => {
                  const isEditing = editingPersonelId === p.id;
                  const isCurrentlyActive = p.id === currentUser.id;

                  if (isEditing) {
                    return (
                      <div key={p.id} className="p-3.5 bg-amber-50/70 border-l-4 border-amber-500 space-y-3">
                        <div className="font-bold text-amber-900 text-xs">
                          Edit Data Personel: {p.nama}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Nama Lengkap</label>
                            <input
                              type="text"
                              value={editNama}
                              onChange={(e) => setEditNama(e.target.value)}
                              placeholder="Nama Personel"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">NIP</label>
                            <input
                              type="text"
                              value={editNip}
                              onChange={(e) => setEditNip(e.target.value)}
                              placeholder="NIP"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Jabatan</label>
                            <input
                              type="text"
                              value={editJabatan}
                              onChange={(e) => setEditJabatan(e.target.value)}
                              placeholder="Jabatan"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Hak Akses / Peran</label>
                            <select
                              value={editPeran}
                              onChange={(e) => setEditPeran(e.target.value as Role)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                            >
                              <option value="staf">Staf Pelaksana</option>
                              <option value="ketua_tim">Ketua Tim (Atasan Pendisposisi)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          {!p.isKetuaTim && p.peran !== 'ketua_tim' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPersonelId(null);
                                setPersonelToDelete(p);
                              }}
                              className="px-2.5 py-1 text-rose-600 hover:bg-rose-100 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus Personel Ini</span>
                            </button>
                          ) : (
                            <div />
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPersonelId(null)}
                              className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-[11px]"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditPersonel(p.id)}
                              className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Simpan & Perbarui Akses Aktif</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={p.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{p.nama}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            p.peran === 'ketua_tim'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {p.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'}
                          </span>
                          {isCurrentlyActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Akses Aktif Saat Ini
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.jabatan} {p.nip && <span className="font-mono">· NIP: {p.nip}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isCurrentlyActive && (
                          <button
                            onClick={() => {
                              onSwitchUser(p);
                              setSaveSuccessMsg(`Akses pengguna aktif berhasil beralih ke: ${p.nama} (${p.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'})`);
                              setTimeout(() => setSaveSuccessMsg(''), 3000);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold border border-blue-200 transition-colors flex items-center gap-1"
                            title="Aktifkan akun ini sekarang"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Gunakan Akun Ini</span>
                          </button>
                        )}

                        <button
                          onClick={() => startEditPersonel(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Personel"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!p.isKetuaTim && p.peran !== 'ketua_tim' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPersonelId(null);
                              setPersonelToDelete(p);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title={`Hapus Personel ${p.nama}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium border border-purple-200"
                            title="Ketua Tim bertindak sebagai atasan langsung pendisposisi surat dan tidak dapat dihapus."
                          >
                            Atasan Langsung
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
