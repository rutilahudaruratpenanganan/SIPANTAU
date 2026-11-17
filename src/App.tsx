/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardStatsCards } from './components/DashboardStatsCards';
import { SuratTable } from './components/SuratTable';
import { ModalSuratMasuk } from './components/ModalSuratMasuk';
import { ModalDisposisi } from './components/ModalDisposisi';
import { ModalTindakLanjut } from './components/ModalTindakLanjut';
import { ModalUploadSuratKeluar } from './components/ModalUploadSuratKeluar';
import { ModalPersonel } from './components/ModalPersonel';
import { ModalPdfViewer } from './components/ModalPdfViewer';
import { ModalLembarDisposisi } from './components/ModalLembarDisposisi';
import { ModalDeleteConfirm } from './components/ModalDeleteConfirm';
import { RekapView } from './components/RekapView';
import { 
  SuratMasuk, 
  Personel, 
  PejabatConfig, 
  Role, 
  TahapTindakLanjutId, 
  DokumenFile 
} from './types';
import { 
  INITIAL_PERSONEL, 
  INITIAL_PEJABAT, 
  INITIAL_SURAT_MASUK 
} from './data/initialData';
import { 
  filterSurat, 
  calculateDashboardStats, 
  TAHAP_TINDAK_LANJUT 
} from './utils/disposisiLogic';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const STORAGE_KEYS = {
  SURAT: 'sipantau_wasdal_surat_v2',
  PERSONEL: 'sipantau_wasdal_personel_v2',
  PEJABAT: 'sipantau_wasdal_pejabat_v2',
};

export default function App() {
  // Load state from localStorage or initial seed
  const [suratList, setSuratList] = useState<SuratMasuk[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SURAT);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved surat', e);
      }
    }
    return INITIAL_SURAT_MASUK;
  });

  const [personelList, setPersonelList] = useState<Personel[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PERSONEL);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved personel', e);
      }
    }
    return INITIAL_PERSONEL;
  });

  const [pejabatConfig, setPejabatConfig] = useState<PejabatConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PEJABAT);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved pejabat', e);
      }
    }
    return INITIAL_PEJABAT;
  });

  // Current session user and role
  const [currentUser, setCurrentUser] = useState<Personel>(() => {
    return personelList.find((p) => p.isKetuaTim) || personelList[0];
  });
  const currentRole: Role = currentUser.peran;

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'surat' | 'personel' | 'rekap'>('dashboard');

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTahap, setSelectedTahap] = useState<TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all'>('all');
  const [selectedPersonel, setSelectedPersonel] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'aktif' | 'selesai'>('all');

  // Modals state
  const [isModalSuratMasukOpen, setIsModalSuratMasukOpen] = useState(false);
  const [isModalDisposisiOpen, setIsModalDisposisiOpen] = useState(false);
  const [selectedSuratForDisposisi, setSelectedSuratForDisposisi] = useState<SuratMasuk | null>(null);

  const [isModalTindakLanjutOpen, setIsModalTindakLanjutOpen] = useState(false);
  const [selectedSuratForTindakLanjut, setSelectedSuratForTindakLanjut] = useState<SuratMasuk | null>(null);

  const [isModalUploadSuratKeluarOpen, setIsModalUploadSuratKeluarOpen] = useState(false);
  const [selectedSuratForSuratKeluar, setSelectedSuratForSuratKeluar] = useState<SuratMasuk | null>(null);

  const [isModalPersonelOpen, setIsModalPersonelOpen] = useState(false);

  const [isModalPdfViewerOpen, setIsModalPdfViewerOpen] = useState(false);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<DokumenFile | null>(null);

  const [isModalLembarDisposisiOpen, setIsModalLembarDisposisiOpen] = useState(false);
  const [selectedSuratForLembar, setSelectedSuratForLembar] = useState<SuratMasuk | null>(null);

  const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
  const [selectedSuratForDelete, setSelectedSuratForDelete] = useState<SuratMasuk | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SURAT, JSON.stringify(suratList));
  }, [suratList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PERSONEL, JSON.stringify(personelList));
  }, [personelList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PEJABAT, JSON.stringify(pejabatConfig));
  }, [pejabatConfig]);

  // Handler: Tambah Surat Masuk
  const handleAddSuratMasuk = (suratData: Partial<SuratMasuk>) => {
    const newSurat: SuratMasuk = {
      id: `surat-${Date.now()}`,
      nomorAgenda: suratData.nomorAgenda || '',
      nomorSurat: suratData.nomorSurat || 'SM/DPKP',
      tanggalSurat: suratData.tanggalSurat || new Date().toISOString().split('T')[0],
      tanggalDiterima: suratData.tanggalDiterima || suratData.tanggalSurat || new Date().toISOString().split('T')[0],
      asalSurat: suratData.asalSurat || '',
      perihal: suratData.perihal || '',
      sifat: suratData.sifat || 'Biasa',
      penerimaDisposisiIds: [],
      penerimaDisposisiNama: [],
      tahapSaatIni: 1, // Stage 1: Disposisi Diterima Dari Kepala Bidang Perumahan
      statusSelesai: false,
      fileSuratMasuk: suratData.fileSuratMasuk,
      riwayatTindakLanjut: [
        {
          id: `r-${Date.now()}-1`,
          tahapId: 1,
          tahapNama: TAHAP_TINDAK_LANJUT[1].nama,
          tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
          aktor: pejabatConfig.kepalaBidang.nama,
          catatan: 'Disposisi naskah dinas masuk diterima dari Kepala Bidang Perumahan.',
        },
      ],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setSuratList([newSurat, ...suratList]);
    showToast(`Surat Masuk dari "${newSurat.asalSurat}" berhasil diregistrasi.`);
  };

  // Handler: Disposisi Surat & Edit Disposisi (by Ketua Tim)
  const handleSaveDisposisi = (
    suratId: string,
    penerimaIds: string[],
    penerimaNama: string[],
    instruksi: string,
    catatan: string,
    tanggalDisposisi: string,
    tenggatWaktu: string
  ) => {
    let wasEditing = false;

    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          wasEditing = Boolean(
            (item.penerimaDisposisiIds && item.penerimaDisposisiIds.length > 0) ||
            item.instruksiDisposisi
          );

          // If stage was 1 or 2, advance to Stage 3: Disposisi Tim
          const newTahap = item.tahapSaatIni < 3 ? 3 : item.tahapSaatIni;
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: (item.tahapSaatIni < 3 ? 3 : item.tahapSaatIni) as TahapTindakLanjutId,
              tahapNama: wasEditing ? 'Pembaruan Disposisi & Instruksi' : TAHAP_TINDAK_LANJUT[3].nama,
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan: wasEditing
                ? `Disposisi dan instruksi diperbarui. Personel: ${penerimaNama.join(', ')}. Instruksi: "${instruksi}"`
                : `Didisposisikan kepada: ${penerimaNama.join(', ')}. Instruksi: "${instruksi}"`,
            },
          ];

          const updated: SuratMasuk = {
            ...item,
            penerimaDisposisiIds: penerimaIds,
            penerimaDisposisiNama: penerimaNama,
            instruksiDisposisi: instruksi,
            catatanDisposisiKetuaTim: catatan,
            tanggalDisposisi,
            tenggatWaktu,
            tahapSaatIni: newTahap,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };

          if (selectedSuratForTindakLanjut?.id === suratId) {
            setSelectedSuratForTindakLanjut(updated);
          }
          if (selectedSuratForDisposisi?.id === suratId) {
            setSelectedSuratForDisposisi(updated);
          }

          return updated;
        }
        return item;
      })
    );

    showToast(
      wasEditing
        ? `Perubahan disposisi & instruksi untuk ${penerimaNama.join(', ')} berhasil disimpan.`
        : `Disposisi berhasil diteruskan kepada ${penerimaNama.join(', ')}.`
    );
  };

  // Handler: Advance Tahap Tindak Lanjut (1-7)
  const handleAdvanceStage = (
    suratId: string,
    nextStage: TahapTindakLanjutId,
    catatan: string
  ) => {
    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: nextStage,
              tahapNama: TAHAP_TINDAK_LANJUT[nextStage].nama,
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan,
            },
          ];

          const updated = {
            ...item,
            tahapSaatIni: nextStage,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };

          if (selectedSuratForTindakLanjut?.id === suratId) {
            setSelectedSuratForTindakLanjut(updated);
          }

          return updated;
        }
        return item;
      })
    );

    showToast(`Status berhasil beralih ke Tahap ${nextStage}: ${TAHAP_TINDAK_LANJUT[nextStage].nama}`);
  };

  // Handler: Update Status Selesai Tindak Lanjut
  const handleUpdateStatusSelesai = (
    suratId: string,
    statusSelesai: boolean,
    catatan?: string,
    tanggalSelesai?: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const finalDate = tanggalSelesai || today;
    const defaultNote = statusSelesai
      ? 'Tindak lanjut naskah dinas telah selesai penuh.'
      : 'Status tindak lanjut dibuka kembali ke status proses berjalan.';
    const finalNote = catatan?.trim() || defaultNote;

    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: item.tahapSaatIni,
              tahapNama: statusSelesai ? 'Selesai Tindak Lanjut' : `Tahap ${item.tahapSaatIni}: ${TAHAP_TINDAK_LANJUT[item.tahapSaatIni]?.nama}`,
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan: finalNote,
            },
          ];

          const updated: SuratMasuk = {
            ...item,
            statusSelesai,
            tanggalSelesai: statusSelesai ? finalDate : undefined,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };

          if (selectedSuratForTindakLanjut?.id === suratId) {
            setSelectedSuratForTindakLanjut(updated);
          }

          return updated;
        }
        return item;
      })
    );

    showToast(
      statusSelesai
        ? 'Status tindak lanjut berhasil ditetapkan: Selesai Tindak Lanjut.'
        : 'Status tindak lanjut berhasil dibuka kembali: Sedang Berjalan.'
    );
  };

  // Handler: Set Tahap Direct
  const handleSetTahapDirect = (suratId: string, tahap: TahapTindakLanjutId, catatan?: string) => {
    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          const note = catatan?.trim() || `Tahapan disesuaikan ke Tahap ${tahap}: ${TAHAP_TINDAK_LANJUT[tahap].nama}`;
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: tahap,
              tahapNama: TAHAP_TINDAK_LANJUT[tahap].nama,
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan: note,
            },
          ];

          const updated: SuratMasuk = {
            ...item,
            tahapSaatIni: tahap,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };

          if (selectedSuratForTindakLanjut?.id === suratId) {
            setSelectedSuratForTindakLanjut(updated);
          }

          return updated;
        }
        return item;
      })
    );

    showToast(`Tahapan tindak lanjut berhasil diubah ke Tahap ${tahap}: ${TAHAP_TINDAK_LANJUT[tahap].nama}`);
  };

  // Handler: Tambah Catatan Tindak Lanjut
  const handleAddCatatan = (suratId: string, catatan: string) => {
    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: item.tahapSaatIni,
              tahapNama: TAHAP_TINDAK_LANJUT[item.tahapSaatIni].nama,
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan,
            },
          ];

          const updated = {
            ...item,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };

          if (selectedSuratForTindakLanjut?.id === suratId) {
            setSelectedSuratForTindakLanjut(updated);
          }

          return updated;
        }
        return item;
      })
    );

    showToast('Catatan tindak lanjut berhasil ditambahkan.');
  };

  // Handler: Upload Surat Keluar
  const handleSaveSuratKeluar = (
    suratId: string,
    fileData: DokumenFile,
    nomorSuratKeluar: string,
    tanggalSuratKeluar: string,
    perihalSuratKeluar: string,
    tandaiSelesai: boolean
  ) => {
    setSuratList((prev) =>
      prev.map((item) => {
        if (item.id === suratId) {
          const newRiwayat = [
            ...item.riwayatTindakLanjut,
            {
              id: `r-${Date.now()}`,
              tahapId: item.tahapSaatIni,
              tahapNama: 'Penerbitan Surat Keluar (TTE PESONA)',
              tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
              aktor: currentUser.nama,
              catatan: `Surat Keluar nomor ${nomorSuratKeluar} telah diunggah dan terbit.`,
              fileLampiran: {
                nama: fileData.nama,
                ukuran: fileData.ukuran,
              },
            },
          ];

          return {
            ...item,
            fileSuratKeluar: fileData,
            nomorSuratKeluar,
            tanggalSuratKeluar,
            perihalSuratKeluar,
            statusSelesai: tandaiSelesai ? true : item.statusSelesai,
            tanggalSelesai: tandaiSelesai ? new Date().toISOString().split('T')[0] : item.tanggalSelesai,
            riwayatTindakLanjut: newRiwayat,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };
        }
        return item;
      })
    );

    showToast(`Berkas Surat Keluar untuk ${nomorSuratKeluar} berhasil diunggah.`);
  };

  // Handler: Hapus Surat (Ketua Tim)
  const handleConfirmDeleteSurat = (suratId: string) => {
    setSuratList((prev) => prev.filter((s) => s.id !== suratId));
    showToast('Surat berhasil dihapus dari sistem persuratan.');
  };

  // Handler: Personel Management & Dynamic Active User Sync
  const handleUpdatePejabat = (newPejabat: PejabatConfig) => {
    setPejabatConfig(newPejabat);

    // Update Ketua Tim in personelList if exists
    let updatedKetua: Personel | null = null;
    const updatedPersonelList = personelList.map((p) => {
      if (p.isKetuaTim || p.peran === 'ketua_tim') {
        const u = {
          ...p,
          nama: newPejabat.ketuaTim.nama,
          nip: newPejabat.ketuaTim.nip,
          jabatan: newPejabat.ketuaTim.jabatan,
        };
        updatedKetua = u;
        return u;
      }
      return p;
    });
    setPersonelList(updatedPersonelList);

    // Directly update active user if current active user is Ketua Tim
    if (currentUser.isKetuaTim || currentUser.peran === 'ketua_tim') {
      if (updatedKetua) {
        setCurrentUser(updatedKetua);
      } else {
        setCurrentUser((prev) => ({
          ...prev,
          nama: newPejabat.ketuaTim.nama,
          nip: newPejabat.ketuaTim.nip,
          jabatan: newPejabat.ketuaTim.jabatan,
        }));
      }
    }

    showToast('Data penandatangan & Ketua Tim disimpan. Akses pengguna aktif langsung diperbarui.');
  };

  const handleAddPersonel = (pData: Omit<Personel, 'id'>) => {
    const newP: Personel = {
      ...pData,
      id: `p-${Date.now()}`,
    };
    setPersonelList([...personelList, newP]);
    // Automatically switch active user to newly added personel
    setCurrentUser(newP);
    showToast(`Personel baru ${newP.nama} berhasil ditambahkan dan akses pengguna aktif langsung beralih.`);
  };

  const handleUpdatePersonel = (id: string, updated: Partial<Personel>) => {
    setPersonelList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
    );

    // Directly update active user if the updated person is the current user or selected
    setCurrentUser((prev) => {
      if (prev.id === id) {
        return {
          ...prev,
          ...updated,
        };
      }
      return prev;
    });

    showToast(`Data personel berhasil diperbarui dan akses pengguna aktif langsung disinkronkan.`);
  };

  const handleDeletePersonel = (id: string) => {
    const target = personelList.find((p) => p.id === id);
    setPersonelList((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      if (currentUser.id === id) {
        const fallback =
          remaining.find((p) => p.isKetuaTim || p.peran === 'ketua_tim') ||
          remaining[0] ||
          INITIAL_PERSONEL[0];
        setCurrentUser(fallback);
      }
      return remaining;
    });
    showToast(`Data personel ${target ? `"${target.nama}"` : ''} berhasil dihapus.`);
  };

  // Handler: Export CSV
  const handleExportCsv = () => {
    const headers = [
      'No',
      'Nomor Surat Masuk',
      'Tanggal Surat',
      'Asal Surat',
      'Perihal',
      'Sifat',
      'Tanggal Disposisi',
      'Penerima Disposisi',
      'Instruksi Disposisi',
      'Tahap Tindak Lanjut',
      'Nama Tahap',
      'Status Selesai',
      'Nomor Surat Keluar',
      'Tanggal Surat Keluar',
    ];

    const rows = suratList.map((s, idx) => [
      idx + 1,
      `"${s.nomorSurat || ''}"`,
      s.tanggalSurat,
      `"${s.asalSurat.replace(/"/g, '""')}"`,
      `"${s.perihal.replace(/"/g, '""')}"`,
      s.sifat,
      s.tanggalDisposisi || '',
      `"${s.penerimaDisposisiNama.join(', ')}"`,
      `"${(s.instruksiDisposisi || '').replace(/"/g, '""')}"`,
      s.tahapSaatIni,
      `"${TAHAP_TINDAK_LANJUT[s.tahapSaatIni]?.nama || ''}"`,
      s.statusSelesai ? 'Selesai' : 'Dalam Proses',
      `"${s.nomorSuratKeluar || ''}"`,
      s.tanggalSuratKeluar || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Rekap_Persuratan_WASDAL_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV rekapitulasi persuratan berhasil diunduh.');
  };

  // Calculate filtered list and dashboard statistics
  const filteredList = filterSurat(suratList, {
    searchQuery,
    tahapId: selectedTahap,
    personelName: selectedPersonel,
    status: selectedStatus,
  });

  const dashboardStats = calculateDashboardStats(suratList, personelList);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar with Branding & User Switcher */}
      <Navbar
        currentRole={currentRole}
        currentUser={currentUser}
        personelList={personelList}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          showToast(`Berpindah ke profil: ${user.nama} (${user.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'})`);
        }}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenTambahSurat={() => setIsModalSuratMasukOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Role & Access Info Bar */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Akses Pengguna Aktif:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${
              currentRole === 'ketua_tim'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              {currentUser.nama} ({currentRole === 'ketua_tim' ? 'Ketua Tim / Atasan Langsung' : 'Staf Tim'})
            </span>
            <span className="text-slate-400 hidden md:inline">·</span>
            <span className="text-slate-500 hidden md:inline">
              {currentRole === 'ketua_tim'
                ? 'Hak akses penuh: Disposisi, Asistensi, Hapus Surat, Manajemen Personel.'
                : 'Hak akses staf: Update progres tindak lanjut, penyusunan draft, upload surat keluar.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalPersonelOpen(true)}
              className="text-blue-600 hover:text-blue-800 font-semibold underline text-xs"
            >
              Ubah Data Personel & Penandatangan (Kadis)
            </button>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <DashboardStatsCards
              stats={dashboardStats}
              selectedTahap={selectedTahap}
              onSelectTahap={(tahap) => {
                setSelectedTahap(tahap);
                // Also scroll gently to the table below
              }}
              onOpenTambahSurat={() => setIsModalSuratMasukOpen(true)}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Daftar Surat Masuk & Pemantauan Disposisi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kelola disposisi atasan langsung, tindak lanjut persuratan, dan penerbitan surat keluar
                  </p>
                </div>
              </div>

              <SuratTable
                suratList={filteredList}
                personelList={personelList}
                currentRole={currentRole}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedTahap={selectedTahap}
                onTahapChange={setSelectedTahap}
                selectedPersonel={selectedPersonel}
                onPersonelChange={setSelectedPersonel}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                onOpenDetail={(s) => {
                  setSelectedSuratForTindakLanjut(s);
                  setIsModalTindakLanjutOpen(true);
                }}
                onOpenDisposisi={(s) => {
                  setSelectedSuratForDisposisi(s);
                  setIsModalDisposisiOpen(true);
                }}
                onOpenUploadSuratKeluar={(s) => {
                  setSelectedSuratForSuratKeluar(s);
                  setIsModalUploadSuratKeluarOpen(true);
                }}
                onOpenPdfViewer={(f) => {
                  setSelectedFileForViewer(f);
                  setIsModalPdfViewerOpen(true);
                }}
                onOpenLembarDisposisi={(s) => {
                  setSelectedSuratForLembar(s);
                  setIsModalLembarDisposisiOpen(true);
                }}
                onDeleteSurat={(s) => {
                  setSelectedSuratForDelete(s);
                  setIsModalDeleteOpen(true);
                }}
                onExportCsv={handleExportCsv}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: DAFTAR SURAT LENGKAP */}
        {activeTab === 'surat' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Seluruh Surat Masuk & Disposisi
                </h2>
                <p className="text-xs text-slate-500">
                  Monitoring persuratan persetujuan dan tindak lanjut Tim Wasdal
                </p>
              </div>

              <button
                onClick={() => setIsModalSuratMasukOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                + Registrasi Surat Masuk
              </button>
            </div>

            <SuratTable
              suratList={filteredList}
              personelList={personelList}
              currentRole={currentRole}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTahap={selectedTahap}
              onTahapChange={setSelectedTahap}
              selectedPersonel={selectedPersonel}
              onPersonelChange={setSelectedPersonel}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              onOpenDetail={(s) => {
                setSelectedSuratForTindakLanjut(s);
                setIsModalTindakLanjutOpen(true);
              }}
              onOpenDisposisi={(s) => {
                setSelectedSuratForDisposisi(s);
                setIsModalDisposisiOpen(true);
              }}
              onOpenUploadSuratKeluar={(s) => {
                setSelectedSuratForSuratKeluar(s);
                setIsModalUploadSuratKeluarOpen(true);
              }}
              onOpenPdfViewer={(f) => {
                setSelectedFileForViewer(f);
                setIsModalPdfViewerOpen(true);
              }}
              onOpenLembarDisposisi={(s) => {
                setSelectedSuratForLembar(s);
                setIsModalLembarDisposisiOpen(true);
              }}
              onDeleteSurat={(s) => {
                setSelectedSuratForDelete(s);
                setIsModalDeleteOpen(true);
              }}
              onExportCsv={handleExportCsv}
            />
          </div>
        )}

        {/* VIEW 3: PERSONEL & PEJABAT */}
        {activeTab === 'personel' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Konfigurasi Personel Tim & Penandatangan Naskah Dinas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Penetapan Kepala Dinas (TTE PESONA), Kepala Bidang, Ketua Tim Pengawasan dan Pengendalian Perumahan, serta staf pelaksana
                  </p>
                </div>
                <button
                  onClick={() => setIsModalPersonelOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Kelola & Edit Personel
                </button>
              </div>

              {/* Pejabat Cards Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                {/* Kadis */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                    Penandatangan Surat / TTE PESONA
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-1">
                    {pejabatConfig.kepalaDinas.nama}
                  </div>
                  <div className="text-slate-600 mt-0.5">{pejabatConfig.kepalaDinas.jabatan}</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-1">
                    NIP. {pejabatConfig.kepalaDinas.nip}
                  </div>
                </div>

                {/* Kabid */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider">
                    Kepala Bidang Perumahan (Tahap 1 & 6)
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-1">
                    {pejabatConfig.kepalaBidang.nama}
                  </div>
                  <div className="text-slate-600 mt-0.5">{pejabatConfig.kepalaBidang.jabatan}</div>
                  <div className="text-slate-500 font-mono text-[11px] mt-1">
                    NIP. {pejabatConfig.kepalaBidang.nip}
                  </div>
                </div>

                {/* Ketua Tim */}
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                    Ketua Tim Wasdal (Atasan Pendisposisi)
                  </span>
                  <div className="font-bold text-sm text-purple-950 mt-1">
                    {pejabatConfig.ketuaTim.nama}
                  </div>
                  <div className="text-purple-800 mt-0.5">{pejabatConfig.ketuaTim.jabatan}</div>
                  <div className="text-purple-600 font-mono text-[11px] mt-1">
                    NIP. {pejabatConfig.ketuaTim.nip}
                  </div>
                </div>

              </div>

              {/* List of staff members */}
              <div className="pt-2">
                <h4 className="font-bold text-xs text-slate-800 mb-2">
                  Daftar Staf Pelaksana ({personelList.filter(p => p.peran === 'staf').length} Personel):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {personelList.filter(p => p.peran === 'staf').map(staf => (
                    <div key={staf.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="font-bold text-slate-900">{staf.nama}</div>
                      <div className="text-[11px] text-slate-500">{staf.jabatan}</div>
                      {staf.nip && <div className="text-[10px] text-slate-400 font-mono mt-0.5">NIP. {staf.nip}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: REKAPITULASI RESMI & PRINT */}
        {activeTab === 'rekap' && (
          <RekapView
            suratList={suratList}
            pejabatConfig={pejabatConfig}
            onExportCsv={handleExportCsv}
            onOpenPdfViewer={(f) => {
              setSelectedFileForViewer(f);
              setIsModalPdfViewerOpen(true);
            }}
          />
        )}

      </main>

      {/* ALL MODALS */}

      {/* 1. Modal Registrasi Surat Masuk */}
      {isModalSuratMasukOpen && (
        <ModalSuratMasuk
          isOpen={isModalSuratMasukOpen}
          onClose={() => setIsModalSuratMasukOpen(false)}
          onSave={handleAddSuratMasuk}
          currentPengunggah={currentUser.nama}
        />
      )}

      {/* 2. Modal Disposisi Ketua Tim */}
      {isModalDisposisiOpen && selectedSuratForDisposisi && (
        <ModalDisposisi
          isOpen={isModalDisposisiOpen}
          onClose={() => {
            setIsModalDisposisiOpen(false);
            setSelectedSuratForDisposisi(null);
          }}
          surat={selectedSuratForDisposisi}
          personelList={personelList}
          onSaveDisposisi={handleSaveDisposisi}
        />
      )}

      {/* 3. Modal Tindak Lanjut Detail (7 Stages & Status Selesai) */}
      {isModalTindakLanjutOpen && selectedSuratForTindakLanjut && (
        <ModalTindakLanjut
          isOpen={isModalTindakLanjutOpen}
          onClose={() => {
            setIsModalTindakLanjutOpen(false);
            setSelectedSuratForTindakLanjut(null);
          }}
          surat={selectedSuratForTindakLanjut}
          currentRole={currentRole}
          currentUser={currentUser}
          onAdvanceStage={handleAdvanceStage}
          onUpdateStatusSelesai={handleUpdateStatusSelesai}
          onSetTahapDirect={handleSetTahapDirect}
          onAddCatatan={handleAddCatatan}
          onOpenUploadSuratKeluar={(s) => {
            setSelectedSuratForSuratKeluar(s);
            setIsModalUploadSuratKeluarOpen(true);
          }}
          onOpenPdfViewer={(f) => {
            setSelectedFileForViewer(f);
            setIsModalPdfViewerOpen(true);
          }}
          onOpenDisposisi={(s) => {
            setSelectedSuratForDisposisi(s);
            setIsModalDisposisiOpen(true);
          }}
        />
      )}

      {/* 4. Modal Upload Surat Keluar (PDF) */}
      {isModalUploadSuratKeluarOpen && selectedSuratForSuratKeluar && (
        <ModalUploadSuratKeluar
          isOpen={isModalUploadSuratKeluarOpen}
          onClose={() => {
            setIsModalUploadSuratKeluarOpen(false);
            setSelectedSuratForSuratKeluar(null);
          }}
          surat={selectedSuratForSuratKeluar}
          onSaveSuratKeluar={handleSaveSuratKeluar}
          currentPengunggah={currentUser.nama}
        />
      )}

      {/* 5. Modal Manajemen Personel & Penandatangan */}
      {isModalPersonelOpen && (
        <ModalPersonel
          isOpen={isModalPersonelOpen}
          onClose={() => setIsModalPersonelOpen(false)}
          personelList={personelList}
          pejabatConfig={pejabatConfig}
          currentRole={currentRole}
          currentUser={currentUser}
          onSwitchUser={(user) => {
            setCurrentUser(user);
            showToast(`Berpindah ke profil: ${user.nama} (${user.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'})`);
          }}
          onUpdatePejabat={handleUpdatePejabat}
          onAddPersonel={handleAddPersonel}
          onUpdatePersonel={handleUpdatePersonel}
          onDeletePersonel={handleDeletePersonel}
        />
      )}

      {/* 6. Modal PDF Document Previewer */}
      {isModalPdfViewerOpen && selectedFileForViewer && (
        <ModalPdfViewer
          isOpen={isModalPdfViewerOpen}
          onClose={() => {
            setIsModalPdfViewerOpen(false);
            setSelectedFileForViewer(null);
          }}
          file={selectedFileForViewer}
        />
      )}

      {/* 7. Modal Cetak Lembar Disposisi Resmi */}
      {isModalLembarDisposisiOpen && selectedSuratForLembar && (
        <ModalLembarDisposisi
          isOpen={isModalLembarDisposisiOpen}
          onClose={() => {
            setIsModalLembarDisposisiOpen(false);
            setSelectedSuratForLembar(null);
          }}
          surat={selectedSuratForLembar}
          pejabatConfig={pejabatConfig}
          personelList={personelList}
        />
      )}

      {/* 8. Modal Konfirmasi Hapus Surat */}
      {isModalDeleteOpen && selectedSuratForDelete && (
        <ModalDeleteConfirm
          isOpen={isModalDeleteOpen}
          onClose={() => {
            setIsModalDeleteOpen(false);
            setSelectedSuratForDelete(null);
          }}
          surat={selectedSuratForDelete}
          onConfirmDelete={handleConfirmDeleteSurat}
        />
      )}

    </div>
  );
}
