import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Save,
  Lock,
} from 'lucide-react';
import { AkunKredensial, LoginAccount } from '../types';
import {
  hashPassword,
  isUsingDefaultPassword,
  validatePasswordChange,
} from '../utils/authLogic';

interface AkunViewProps {
  currentAccount: LoginAccount;
  credential?: AkunKredensial | null;
  onSaveNewPassword: (accountId: string, newHash: string) => Promise<void>;
  onLogout: () => void;
}

export const AkunView: React.FC<AkunViewProps> = ({
  currentAccount,
  credential,
  onSaveNewPassword,
  onLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const stillDefault = isUsingDefaultPassword(credential);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validation = await validatePasswordChange({
      currentPasswordInput: currentPassword,
      newPassword,
      confirmPassword,
      storedCredential: credential,
    });

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Periksa kembali isian password Anda.');
      return;
    }

    setIsSaving(true);
    try {
      const newHash = await hashPassword(newPassword);
      await onSaveNewPassword(currentAccount.id, newHash);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg(
        'Password akun Anda berhasil diperbarui dan tersimpan permanen. Gunakan password baru tersebut saat login berikutnya.'
      );
    } catch {
      setErrorMsg('Gagal menyimpan password baru ke database. Silakan coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Account Identity & Role Overview */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                currentAccount.peran === 'ketua_tim'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {currentAccount.peran === 'ketua_tim' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <UserCheck className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <span
                className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  currentAccount.peran === 'ketua_tim'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {currentAccount.displayRole}
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1 break-words">
                {currentAccount.nama}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">{currentAccount.jabatan}</p>
              {currentAccount.nip && (
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  NIP. {currentAccount.nip}
                </p>
              )}
            </div>
          </div>

          {/* Password Security Status */}
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              stillDefault
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>
                {stillDefault
                  ? 'Menggunakan Password Awal'
                  : 'Password Pribadi Aktif'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {stillDefault
                ? 'Akun ini masih menggunakan password awal standar. Demi keamanan akun, segera ubah password Anda pada formulir di samping.'
                : `Password pribadi telah diatur dan terenkripsi SHA-256.${
                    credential?.updatedAt ? ` Terakhir diubah: ${credential.updatedAt}.` : ''
                  }`}
            </p>
          </div>

          {/* Hak Akses Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="font-bold text-slate-800">Hak Akses Akun Ini</div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {currentAccount.peran === 'ketua_tim'
                ? 'Hak akses penuh Pendisposisi: registrasi surat masuk, disposisi & instruksi personel, asistensi tindak lanjut, cetak rekap, backup arsip (.zip), hapus surat, serta manajemen data personel.'
                : 'Hak akses Staf Wasdal: melihat dashboard pemantauan, registrasi surat masuk, memperbarui tahapan tindak lanjut / draft, mengunggah surat keluar, mencetak lembar & rekap, serta mengelola password akun sendiri.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun (Logout)</span>
          </button>
        </div>
      </div>

      {/* Right: Change Password Form */}
      <div className="lg:col-span-7">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Ubah Password Akun</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ketua Tim dan Staf Wasdal dapat memperbarui password akun masing-masing secara mandiri
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Password Saat Ini */}
            <div className="space-y-1.5">
              <label
                htmlFor="current-password"
                className="block font-semibold text-slate-700"
              >
                Password Saat Ini <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Masukkan password Anda saat ini..."
                  autoComplete="current-password"
                  className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? 'Sembunyikan password saat ini' : 'Tampilkan password saat ini'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Baru */}
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block font-semibold text-slate-700">
                Password Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Minimal 4 karakter..."
                  autoComplete="new-password"
                  className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Konfirmasi Password Baru */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="block font-semibold text-slate-700"
              >
                Konfirmasi Password Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Ketik ulang password baru..."
                  autoComplete="new-password"
                  className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={
                    showConfirm
                      ? 'Sembunyikan konfirmasi password'
                      : 'Tampilkan konfirmasi password'
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
