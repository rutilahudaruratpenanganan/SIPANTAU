import React, { useState } from 'react';
import {
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  MailCheck,
  ChevronDown,
} from 'lucide-react';
import loginBackdropUrl from '../assets/images/persuratan_login_backdrop_1795136209602.jpg';
import { LoginAccount } from '../types';
import { verifyAccountPassword } from '../utils/authLogic';
import type { AkunKredensial } from '../types';

interface LoginPageProps {
  accounts: LoginAccount[];
  akunKredensialMap: Record<string, AkunKredensial>;
  onLoginSuccess: (account: LoginAccount) => void;
  sessionNotice?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  accounts,
  akunKredensialMap,
  onLoginSuccess,
  sessionNotice,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [backdropFailed, setBackdropFailed] = useState<boolean>(false);

  const ketuaAccounts = accounts.filter((a) => a.kategori === 'ketua_tim');
  const adminAccounts = accounts.filter((a) => a.kategori === 'administrator');
  const stafAccounts = accounts.filter((a) => a.kategori === 'staf');
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedAccount) {
      setErrorMsg('Silakan pilih akun Anda terlebih dahulu.');
      return;
    }

    if (!password) {
      setErrorMsg('Silakan masukkan password akun Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = akunKredensialMap[selectedAccount.id] || null;
      const isValid = await verifyAccountPassword(password, cred);
      if (!isValid) {
        setErrorMsg('Password tidak sesuai. Periksa kembali password akun Anda.');
        return;
      }
      onLoginSuccess(selectedAccount);
    } catch {
      setErrorMsg('Terjadi kendala saat memverifikasi password. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex items-center justify-center p-4 sm:p-8 font-sans">
      {/* Full-Screen Persuratan Architectural Backdrop */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        {!backdropFailed ? (
          <img
            src={loginBackdropUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBackdropFailed(true)}
            className="w-full h-full object-cover object-center opacity-50 scale-[1.01]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
        )}

        {/* Measured Navy Scrim & Crisp Archival Framing Lines */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/85" />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.09]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="persuratan-ledger-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="0.75"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#persuratan-ledger-grid)" />
        </svg>
      </div>

      {/* Centered Login Window */}
      <div className="relative z-10 w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Institutional Header Band */}
        <div className="bg-slate-900 px-6 py-6 text-white border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 shadow-sm ring-1 ring-white/20 shrink-0 flex items-center justify-center">
              <img
                src="/assets/aistudio/Document_Verification_App_Icon_ef2df0ab.png"
                alt="Logo SIPANTAU-WASDAL"
                className="w-full h-full object-cover scale-[1.12]"
              />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-lg tracking-tight text-white leading-tight">
                SIPANTAU-WASDAL
              </div>
              <p className="text-xs font-medium text-blue-200 leading-snug mt-0.5">
                Sistem Informasi Persuratan, Agenda, dan Pemantauan
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Tim Pengendalian dan Pengawasan Perumahan
              </p>
            </div>
          </div>
        </div>

        {/* Correspondence Domain Strip */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-[11px] font-medium text-slate-600">
          <MailCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Portal Administrasi Persuratan, Disposisi &amp; Tindak Lanjut</span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5 text-xs">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Masuk ke Aplikasi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Pilih akun Anda</p>
          </div>

          {sessionNotice && !errorMsg && (
            <div
              role="status"
              data-testid="login-session-notice"
              className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-username"
              className="block font-semibold text-slate-700 text-xs"
            >
              Username <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="login-username"
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full appearance-none pl-9 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="">-- Pilih Akun Anda --</option>
                {ketuaAccounts.length > 0 && (
                  <optgroup label="Ketua Tim">
                    {ketuaAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nama} — {acc.displayRole}
                      </option>
                    ))}
                  </optgroup>
                )}
                {adminAccounts.length > 0 && (
                  <optgroup label="Administrator">
                    {adminAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nama} — {acc.displayRole}
                      </option>
                    ))}
                  </optgroup>
                )}
                {stafAccounts.length > 0 && (
                  <optgroup label="Staf Wasdal">
                    {stafAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nama} — {acc.displayRole}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedAccount && (
              <div className="pt-1 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="font-semibold text-slate-800">{selectedAccount.jabatan}</span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span
                  className={
                    selectedAccount.peran === 'ketua_tim' || selectedAccount.peran === 'administrator'
                      ? 'font-semibold text-amber-700'
                      : 'font-semibold text-blue-700'
                  }
                >
                  {selectedAccount.displayRole}
                </span>
                {selectedAccount.nip && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      NIP. {selectedAccount.nip}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="block font-semibold text-slate-700 text-xs"
            >
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Masukkan password akun..."
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 text-xs"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
          </button>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Akses Internal Terproteksi · SIPANTAU-WASDAL</span>
          </div>
        </form>
      </div>
    </div>
  );
};
