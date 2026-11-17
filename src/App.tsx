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
import { CheckCircle2, AlertCircle, Building2, ShieldCheck, Loader2, LogIn, Copy, Check, ExternalLink } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import {
  createPersonelDb,
  createSuratMasukDb,
  deletePersonelDb,
  deleteSuratDb,
  ensureWorkspaceInitialized,
  subscribePersonel,
  subscribeSuratMasuk,
  subscribeWorkspace,
  updateDisposisiDb,
  updatePersonelDb,
  updateStageOrCatatanDb,
  updateStatusSelesaiDb,
  updateWorkspacePejabatDb,
  uploadSuratKeluarDb,
} from './services/firestoreService';

export default function App() {
  // Firebase Authentication & Workspace Loading State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  if (asyncError) {
    throw asyncError;
  }

  // Real-time Firestore-backed state
  const [suratList, setSuratList] = useState<SuratMasuk[]>([]);
  const [personelList, setPersonelList] = useState<Personel[]>(INITIAL_PERSONEL);
  const [pejabatConfig, setPejabatConfig] = useState<PejabatConfig>(INITIAL_PEJABAT);

  // Active simulated role/personel inside workspace
  const [activePersonelId, setActivePersonelId] = useState<string>('');
  const currentUser: Personel =
    personelList.find((p) => p.id === activePersonelId) ||
    personelList.find((p) => p.isKetuaTim || p.peran === 'ketua_tim') ||
    personelList[0] ||
    INITIAL_PERSONEL[0];
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
  const [selectedSuratForDisposisiId, setSelectedSuratForDisposisiId] = useState<string | null>(null);

  const [isModalTindakLanjutOpen, setIsModalTindakLanjutOpen] = useState(false);
  const [selectedSuratForTindakLanjutId, setSelectedSuratForTindakLanjutId] = useState<string | null>(null);

  const [isModalUploadSuratKeluarOpen, setIsModalUploadSuratKeluarOpen] = useState(false);
  const [selectedSuratForSuratKeluarId, setSelectedSuratForSuratKeluarId] = useState<string | null>(null);

  const [isModalPersonelOpen, setIsModalPersonelOpen] = useState(false);

  const [isModalPdfViewerOpen, setIsModalPdfViewerOpen] = useState(false);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<DokumenFile | null>(null);

  const [isModalLembarDisposisiOpen, setIsModalLembarDisposisiOpen] = useState(false);
  const [selectedSuratForLembarId, setSelectedSuratForLembarId] = useState<string | null>(null);

  const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
  const [selectedSuratForDeleteId, setSelectedSuratForDeleteId] = useState<string | null>(null);

  const selectedSuratForDisposisi = suratList.find((s) => s.id === selectedSuratForDisposisiId) || null;
  const selectedSuratForTindakLanjut = suratList.find((s) => s.id === selectedSuratForTindakLanjutId) || null;
  const selectedSuratForSuratKeluar = suratList.find((s) => s.id === selectedSuratForSuratKeluarId) || null;
  const selectedSuratForLembar = suratList.find((s) => s.id === selectedSuratForLembarId) || null;
  const selectedSuratForDelete = suratList.find((s) => s.id === selectedSuratForDeleteId) || null;

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Track Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setDbReady(false);
        setSuratList([]);
        setPersonelList(INITIAL_PERSONEL);
        setPejabatConfig(INITIAL_PEJABAT);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize workspace and attach Firestore listeners only when authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    let cancelled = false;
    let unsubWorkspace: (() => void) | undefined;
    let unsubPersonel: (() => void) | undefined;
    let unsubSurat: (() => void) | undefined;

    (async () => {
      try {
        await ensureWorkspaceInitialized(firebaseUser);
        if (cancelled) return;

        unsubWorkspace = subscribeWorkspace(
          firebaseUser.uid,
          (cfg) => setPejabatConfig(cfg),
          (err) => setAsyncError(err)
        );
        unsubPersonel = subscribePersonel(
          firebaseUser.uid,
          (list) => {
            if (list.length > 0) setPersonelList(list);
          },
          (err) => setAsyncError(err)
        );
        unsubSurat = subscribeSuratMasuk(
          firebaseUser.uid,
          (list) => {
            setSuratList(list);
            setDbReady(true);
          },
          (err) => setAsyncError(err)
        );
      } catch (err) {
        if (!cancelled) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubWorkspace?.();
      unsubPersonel?.();
      unsubSurat?.();
    };
  }, [authReady, firebaseUser]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setUnauthorizedDomain(null);
    setCopiedDomain(false);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomain(hostname);
        setAuthError(
          'Domain ini belum terdaftar di Firebase Console (Authentication → Settings → Authorized domains).'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Login dibatalkan sebelum selesai. Silakan coba lagi.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCopyDomain = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Handler: Tambah Surat Masuk
  const handleAddSuratMasuk = async (suratData: Partial<SuratMasuk>) => {
    if (!firebaseUser) return;
    try {
      await createSuratMasukDb(firebaseUser.uid, suratData, pejabatConfig);
      showToast(`Surat Masuk dari "${suratData.asalSurat || '-'}" berhasil disimpan ke database.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Disposisi Surat & Edit Disposisi (by Ketua Tim)
  const handleSaveDisposisi = async (
    suratId: string,
    penerimaIds: string[],
    penerimaNama: string[],
    instruksi: string,
    catatan: string,
    tanggalDisposisi: string,
    tenggatWaktu: string
  ) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk mengubah disposisi.');
      return;
    }

    const wasEditing = Boolean(
      (item.penerimaDisposisiIds && item.penerimaDisposisiIds.length > 0) ||
      item.instruksiDisposisi
    );
    const newTahap = (item.tahapSaatIni < 3 ? 3 : item.tahapSaatIni) as TahapTindakLanjutId;
    const newRiwayat = [
      ...item.riwayatTindakLanjut,
      {
        id: `r-${Date.now()}`,
        tahapId: newTahap,
        tahapNama: wasEditing ? 'Pembaruan Disposisi & Instruksi' : TAHAP_TINDAK_LANJUT[3].nama,
        tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
        aktor: currentUser.nama,
        catatan: wasEditing
          ? `Disposisi dan instruksi diperbarui. Personel: ${penerimaNama.join(', ')}. Instruksi: "${instruksi}"`
          : `Didisposisikan kepada: ${penerimaNama.join(', ')}. Instruksi: "${instruksi}"`,
      },
    ];

    try {
      await updateDisposisiDb(
        suratId,
        penerimaIds,
        penerimaNama,
        instruksi,
        catatan,
        tanggalDisposisi,
        tenggatWaktu,
        newTahap,
        newRiwayat
      );
      showToast(
        wasEditing
          ? `Perubahan disposisi & instruksi untuk ${penerimaNama.join(', ')} berhasil disimpan.`
          : `Disposisi berhasil diteruskan kepada ${penerimaNama.join(', ')}.`
      );
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Advance Tahap Tindak Lanjut (1-7)
  const handleAdvanceStage = async (
    suratId: string,
    nextStage: TahapTindakLanjutId,
    catatan: string
  ) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk mengubah tahapan.');
      return;
    }

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

    try {
      await updateStageOrCatatanDb(suratId, nextStage, newRiwayat);
      showToast(`Status berhasil beralih ke Tahap ${nextStage}: ${TAHAP_TINDAK_LANJUT[nextStage].nama}`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Update Status Selesai Tindak Lanjut
  const handleUpdateStatusSelesai = async (
    suratId: string,
    statusSelesai: boolean,
    catatan?: string,
    tanggalSelesai?: string
  ) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai && statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Klik "Buka Kembali" terlebih dahulu jika ingin memperbarui data.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const finalDate = tanggalSelesai || today;
    const defaultNote = statusSelesai
      ? 'Tindak lanjut naskah dinas telah selesai penuh.'
      : 'Status tindak lanjut dibuka kembali ke status proses berjalan.';
    const finalNote = catatan?.trim() || defaultNote;

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

    try {
      await updateStatusSelesaiDb(suratId, statusSelesai, finalDate, newRiwayat);
      showToast(
        statusSelesai
          ? 'Status tindak lanjut berhasil ditetapkan: Selesai Tindak Lanjut.'
          : 'Status tindak lanjut berhasil dibuka kembali: Sedang Berjalan.'
      );
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Set Tahap Direct
  const handleSetTahapDirect = async (suratId: string, tahap: TahapTindakLanjutId, catatan?: string) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk mengubah tahapan.');
      return;
    }

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

    try {
      await updateStageOrCatatanDb(suratId, tahap, newRiwayat);
      showToast(`Tahapan tindak lanjut berhasil diubah ke Tahap ${tahap}: ${TAHAP_TINDAK_LANJUT[tahap].nama}`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Tambah Catatan Tindak Lanjut
  const handleAddCatatan = async (suratId: string, catatan: string) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk menambah catatan.');
      return;
    }

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

    try {
      await updateStageOrCatatanDb(suratId, item.tahapSaatIni, newRiwayat);
      showToast('Catatan tindak lanjut berhasil ditambahkan.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Upload Surat Keluar
  const handleSaveSuratKeluar = async (
    suratId: string,
    fileData: DokumenFile,
    nomorSuratKeluar: string,
    tanggalSuratKeluar: string,
    perihalSuratKeluar: string,
    tandaiSelesai: boolean
  ) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk mengunggah Surat Keluar.');
      return;
    }

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

    const finalStatusSelesai = tandaiSelesai ? true : item.statusSelesai;
    const finalTanggalSelesai = tandaiSelesai
      ? new Date().toISOString().split('T')[0]
      : item.tanggalSelesai;

    try {
      await uploadSuratKeluarDb(
        suratId,
        fileData,
        nomorSuratKeluar,
        tanggalSuratKeluar,
        perihalSuratKeluar,
        finalStatusSelesai,
        finalTanggalSelesai,
        newRiwayat
      );
      showToast(`Berkas Surat Keluar untuk ${nomorSuratKeluar} berhasil diunggah.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Hapus Surat (Ketua Tim)
  const handleConfirmDeleteSurat = async (suratId: string) => {
    try {
      await deleteSuratDb(suratId);
      showToast('Surat berhasil dihapus dari database.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Personel Management & Dynamic Active User Sync
  const handleUpdatePejabat = async (newPejabat: PejabatConfig) => {
    if (!firebaseUser) return;
    try {
      await updateWorkspacePejabatDb(firebaseUser.uid, newPejabat);
      const ketua = personelList.find((p) => p.isKetuaTim || p.peran === 'ketua_tim');
      if (ketua) {
        await updatePersonelDb(ketua.id, {
          nama: newPejabat.ketuaTim.nama,
          nip: newPejabat.ketuaTim.nip,
          jabatan: newPejabat.ketuaTim.jabatan,
          peran: 'ketua_tim',
          isKetuaTim: true,
        });
      }
      showToast('Data penandatangan & Ketua Tim disimpan ke database.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAddPersonel = async (pData: Omit<Personel, 'id'>) => {
    if (!firebaseUser) return;
    try {
      const created = await createPersonelDb(firebaseUser.uid, pData);
      setActivePersonelId(created.id);
      showToast(`Personel baru ${created.nama} berhasil ditambahkan dan akses pengguna aktif langsung beralih.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdatePersonel = async (id: string, updated: Partial<Personel>) => {
    try {
      await updatePersonelDb(id, updated);
      showToast('Data personel berhasil diperbarui di database.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeletePersonel = async (id: string) => {
    const target = personelList.find((p) => p.id === id);
    try {
      await deletePersonelDb(id);
      if (activePersonelId === id) {
        setActivePersonelId('');
      }
      showToast(`Data personel ${target ? `"${target.nama}"` : ''} berhasil dihapus.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
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

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-600 text-xs">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span>Menghubungkan ke layanan autentikasi & database...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight">SIPANTAU-WASDAL</div>
                <div className="text-[11px] text-blue-200">
                  Tim Pengawasan dan Pengendalian Perumahan · DPKP
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-base font-bold text-slate-900">
                Masuk ke Database Persuratan
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gunakan akun Google untuk mengakses dan menyinkronkan data surat masuk, disposisi, serta progres tindak lanjut secara aman di Cloud Firestore.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{authError}</span>
                </div>

                {unauthorizedDomain && (
                  <div className="space-y-2 pt-2 border-t border-rose-200/80">
                    <div className="text-[11px] text-rose-800">
                      Salin domain berikut dan tambahkan ke <strong>Authorized domains</strong> pada proyek{' '}
                      <span className="font-mono font-semibold">{firebaseConfig.projectId}</span>:
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-lg px-2.5 py-1.5">
                      <code className="flex-1 text-[11px] font-mono text-slate-800 truncate">
                        {unauthorizedDomain}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyDomain}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        {copiedDomain ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline"
                    >
                      <span>Buka Firebase Console → Authorized domains</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isSigningIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{isSigningIn ? 'Memproses Login...' : 'Masuk dengan Google'}</span>
            </button>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Data persuratan tersimpan otomatis di Firebase Firestore.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-600 text-xs">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span>Memuat data persuratan dari Cloud Firestore...</span>
        </div>
      </div>
    );
  }

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
          setActivePersonelId(user.id);
          showToast(`Berpindah ke profil: ${user.nama} (${user.peran === 'ketua_tim' ? 'Ketua Tim' : 'Staf'})`);
        }}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenTambahSurat={() => setIsModalSuratMasukOpen(true)}
        authEmail={firebaseUser.email}
        onSignOut={handleSignOut}
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
                  setSelectedSuratForTindakLanjutId(s.id);
                  setIsModalTindakLanjutOpen(true);
                }}
                onOpenDisposisi={(s) => {
                  setSelectedSuratForDisposisiId(s.id);
                  setIsModalDisposisiOpen(true);
                }}
                onOpenUploadSuratKeluar={(s) => {
                  setSelectedSuratForSuratKeluarId(s.id);
                  setIsModalUploadSuratKeluarOpen(true);
                }}
                onOpenPdfViewer={(f) => {
                  setSelectedFileForViewer(f);
                  setIsModalPdfViewerOpen(true);
                }}
                onOpenLembarDisposisi={(s) => {
                  setSelectedSuratForLembarId(s.id);
                  setIsModalLembarDisposisiOpen(true);
                }}
                onDeleteSurat={(s) => {
                  setSelectedSuratForDeleteId(s.id);
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
                setSelectedSuratForTindakLanjutId(s.id);
                setIsModalTindakLanjutOpen(true);
              }}
              onOpenDisposisi={(s) => {
                setSelectedSuratForDisposisiId(s.id);
                setIsModalDisposisiOpen(true);
              }}
              onOpenUploadSuratKeluar={(s) => {
                setSelectedSuratForSuratKeluarId(s.id);
                setIsModalUploadSuratKeluarOpen(true);
              }}
              onOpenPdfViewer={(f) => {
                setSelectedFileForViewer(f);
                setIsModalPdfViewerOpen(true);
              }}
              onOpenLembarDisposisi={(s) => {
                setSelectedSuratForLembarId(s.id);
                setIsModalLembarDisposisiOpen(true);
              }}
              onDeleteSurat={(s) => {
                setSelectedSuratForDeleteId(s.id);
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
            setSelectedSuratForDisposisiId(null);
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
            setSelectedSuratForTindakLanjutId(null);
          }}
          surat={selectedSuratForTindakLanjut}
          currentRole={currentRole}
          currentUser={currentUser}
          onAdvanceStage={handleAdvanceStage}
          onUpdateStatusSelesai={handleUpdateStatusSelesai}
          onSetTahapDirect={handleSetTahapDirect}
          onAddCatatan={handleAddCatatan}
          onOpenUploadSuratKeluar={(s) => {
            setSelectedSuratForSuratKeluarId(s.id);
            setIsModalUploadSuratKeluarOpen(true);
          }}
          onOpenPdfViewer={(f) => {
            setSelectedFileForViewer(f);
            setIsModalPdfViewerOpen(true);
          }}
          onOpenDisposisi={(s) => {
            setSelectedSuratForDisposisiId(s.id);
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
            setSelectedSuratForSuratKeluarId(null);
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
            setActivePersonelId(user.id);
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
            setSelectedSuratForLembarId(null);
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
            setSelectedSuratForDeleteId(null);
          }}
          surat={selectedSuratForDelete}
          onConfirmDelete={handleConfirmDeleteSurat}
        />
      )}

    </div>
  );
}
