import React from 'react';
import { 
  Users, 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  Printer,
  ChevronDown,
  LayoutDashboard,
  HardDriveDownload,
  KeyRound,
  LogOut,
  UserCog
} from 'lucide-react';
import { LoginAccount, Role } from '../types';
import { canAccessBackup, canManagePersonel, isFullAccessRole } from '../utils/disposisiLogic';

export type NavTab = 'dashboard' | 'surat' | 'personel' | 'rekap' | 'backup' | 'akun';

interface NavbarProps {
  currentRole: Role;
  currentAccount: LoginAccount;
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentAccount,
  activeTab,
  onChangeTab,
  onLogout,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="w-full max-w-[2000px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Brand Wordmark & Department */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-slate-900 shadow-sm ring-1 ring-white/15 shrink-0 flex items-center justify-center">
              <img
                src="/assets/aistudio/Document_Verification_App_Icon_ef2df0ab.png"
                alt="Logo SIPANTAU-WASDAL"
                className="w-full h-full object-cover scale-[1.12]"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap truncate sm:overflow-visible">
                  SIPANTAU-WASDAL
                </span>
                <span className="hidden 2xl:inline-block text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium border border-blue-400/20">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 whitespace-nowrap hidden 2xl:block">
                Tim Pengawasan dan Pengendalian Perumahan · DPKP
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 text-xs font-medium shrink-0">
            <button
              onClick={() => onChangeTab('dashboard')}
              className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => onChangeTab('surat')}
              className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'surat'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Daftar Surat & Disposisi</span>
            </button>
            {canManagePersonel(currentRole) && (
              <button
                onClick={() => onChangeTab('personel')}
                className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'personel'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>Personel</span>
              </button>
            )}
            <button
              onClick={() => onChangeTab('rekap')}
              className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'rekap'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Cetak Rekap</span>
            </button>
            {canAccessBackup(currentRole) && (
              <button
                onClick={() => onChangeTab('backup')}
                className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'backup'
                    ? 'bg-emerald-700/80 text-white font-semibold border border-emerald-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Backup surat masuk berstatus selesai ke laptop (Ketua Tim & Administrator)"
              >
                <HardDriveDownload className="w-4 h-4 text-emerald-400" />
                <span>Backup Arsip</span>
              </button>
            )}
            <button
              onClick={() => onChangeTab('akun')}
              className={`flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'akun'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Halaman Akun & Ubah Password"
            >
              <UserCog className="w-4 h-4 text-sky-400" />
              <span>Akun Saya</span>
            </button>
          </nav>

          {/* Active Authenticated Account Menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-colors text-xs"
                title="Menu Akun & Ubah Password"
                aria-label="Menu Akun Aktif"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  isFullAccessRole(currentRole) ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isFullAccessRole(currentRole) ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="hidden md:block leading-tight">
                  <div className="font-semibold text-slate-100 truncate max-w-[150px]">
                    {currentAccount.nama}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentAccount.displayRole}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Account Action Dropdown */}
              {showUserDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-68 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-2 text-xs">
                    <div className="px-3.5 py-2.5 border-b border-slate-800">
                      <div className="font-semibold text-slate-100 truncate">
                        {currentAccount.nama}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {currentAccount.jabatan}
                      </div>
                      <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded font-semibold ${
                        isFullAccessRole(currentRole)
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {currentAccount.displayRole}
                      </span>
                    </div>

                    <div className="p-1.5 space-y-1">
                      <button
                        onClick={() => {
                          onChangeTab('akun');
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors font-medium"
                      >
                        <KeyRound className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>Akun Saya &amp; Ubah Password</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 flex items-center gap-2 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Keluar / Ganti Akun</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Compact Mobile/Tablet Navigation Strip */}
      <nav
        aria-label="Navigasi seluler"
        className="lg:hidden border-t border-slate-800 bg-slate-900/95 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium"
      >
        <button
          onClick={() => onChangeTab('dashboard')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'dashboard' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => onChangeTab('surat')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'surat' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Daftar Surat</span>
        </button>
        {canManagePersonel(currentRole) && (
          <button
            onClick={() => onChangeTab('personel')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
              activeTab === 'personel' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Personel</span>
          </button>
        )}
        <button
          onClick={() => onChangeTab('rekap')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'rekap' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
          }`}
        >
          <Printer className="w-3.5 h-3.5 text-purple-400" />
          <span>Cetak Rekap</span>
        </button>
        {canAccessBackup(currentRole) && (
          <button
            onClick={() => onChangeTab('backup')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
              activeTab === 'backup'
                ? 'bg-emerald-700/80 text-white font-semibold'
                : 'text-emerald-300'
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Backup Arsip</span>
          </button>
        )}
        <button
          onClick={() => onChangeTab('akun')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 ${
            activeTab === 'akun' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
          }`}
        >
          <UserCog className="w-3.5 h-3.5 text-sky-400" />
          <span>Akun Saya</span>
        </button>
      </nav>
    </header>
  );
};
