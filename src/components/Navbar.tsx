import React from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  Plus, 
  ShieldCheck, 
  UserCheck, 
  Printer,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { Personel, Role } from '../types';

interface NavbarProps {
  currentRole: Role;
  currentUser: Personel;
  personelList: Personel[];
  onSwitchUser: (personel: Personel) => void;
  activeTab: 'dashboard' | 'surat' | 'personel' | 'rekap';
  onChangeTab: (tab: 'dashboard' | 'surat' | 'personel' | 'rekap') => void;
  onOpenTambahSurat: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentUser,
  personelList,
  onSwitchUser,
  activeTab,
  onChangeTab,
  onOpenTambahSurat,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Brand Wordmark & Department */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-inner font-bold text-lg shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap truncate">
                  SIPANTAU-WASDAL
                </span>
                <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium border border-blue-400/20">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 whitespace-nowrap hidden 2xl:block">
                Tim Pengawasan dan Pengendalian Perumahan · DPKP
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-medium shrink-0">
            <button
              onClick={() => onChangeTab('dashboard')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'surat'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Daftar Surat & Disposisi</span>
            </button>
            <button
              onClick={() => onChangeTab('personel')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'personel'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Personel & Pejabat</span>
            </button>
            <button
              onClick={() => onChangeTab('rekap')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'rekap'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Printer className="w-4 h-4 text-purple-400" />
              <span>Cetak Rekap</span>
            </button>
          </nav>

          {/* Actions: Add Surat + Active User / Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onOpenTambahSurat}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Surat Masuk</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {/* Role & User Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-colors text-xs"
                title="Ganti Pengguna Aktif (Ketua Tim / Staf)"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentRole === 'ketua_tim' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {currentRole === 'ketua_tim' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="hidden lg:block leading-tight">
                  <div className="font-semibold text-slate-100 truncate max-w-[140px]">
                    {currentUser.nama}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentRole === 'ketua_tim' ? 'Ketua Tim' : 'Staf Pelaksana'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* User Dropdown */}
              {showUserDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-2 text-xs">
                    <div className="px-3.5 py-2 border-b border-slate-800 text-slate-400">
                      <div className="font-semibold text-slate-200">Hak Akses & Pengguna Aktif</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Pilih profil untuk beralih hak akses internal (Ketua Tim vs Staf)
                      </div>
                    </div>

                    <div className="px-2 py-1 max-h-64 overflow-y-auto">
                      {personelList.map((p) => {
                        const isSelected = p.id === currentUser.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              onSwitchUser(p);
                              setShowUserDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between my-0.5 transition-colors ${
                              isSelected
                                ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-medium text-slate-200">{p.nama}</div>
                              <div className="text-[10px] text-slate-400">{p.jabatan}</div>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                              p.peran === 'ketua_tim'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {p.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-3 py-2 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
                      <div>
                        <span className="font-medium text-slate-300">Ketua Tim:</span> Disposisi & hapus surat. <br/>
                        <span className="font-medium text-slate-300">Staf:</span> Update draft & upload surat keluar.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
