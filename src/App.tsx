/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardStatsCards } from './components/DashboardStatsCards';
import { DashboardAgendaTicker } from './components/DashboardAgendaTicker';
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
import { BackupView } from './components/BackupView';
import { LoginPage } from './components/LoginPage';
import { AkunView } from './components/AkunView';
import { AgendaView } from './components/AgendaView';
import { ModalAgenda } from './components/ModalAgenda';
import { PekerjaanView } from './components/PekerjaanView';
import { ModalPaketPekerjaan } from './components/ModalPaketPekerjaan';
import { ModalWorkflowTahapan } from './components/ModalWorkflowTahapan';
import {
  ModalCetakPekerjaan,
  ModalCetakPekerjaanInitialState,
} from './components/ModalCetakPekerjaan';
import { 
  AgendaEvent,
  AkunKredensial,
  LoginAccount,
  NotifikasiDisposisi,
  PaketPekerjaan,
  SuratMasuk, 
  Personel, 
  PejabatConfig, 
  Role, 
  SkemaPembayaran,
  TahapPekerjaan,
  TahapTindakLanjutId, 
  TerminPekerjaan,
  DokumenFile 
} from './types';
import { 
  INITIAL_PERSONEL, 
  INITIAL_PEJABAT
} from './data/initialData';
import { 
  filterSurat, 
  calculateDashboardStats, 
  TAHAP_TINDAK_LANJUT,
  canAccessBackup,
  canAdvanceStage,
  canCreateDisposisi,
  canDeleteSurat,
  canManagePersonel,
  isFullAccessRole
} from './utils/disposisiLogic';
import {
  countUnreadNotifications,
  filterNotificationsForAccount,
} from './utils/notifikasiLogic';
import {
  DEFAULT_INITIAL_PASSWORD,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_THRESHOLD_MS,
  buildLoginAccounts,
  getIdleRemainingMs,
  hashPassword,
  isSessionIdleExpired,
  parseStoredTimestamp,
} from './utils/authLogic';
import { CheckCircle2, Clock } from 'lucide-react';
import {
  AgendaMutationPayload,
  AgendaReschedulePayload,
  PaketPekerjaanMutationPayload,
  cancelAgendaEventDb,
  createAgendaEventDb,
  createPaketPekerjaanDb,
  createPersonelDb,
  createSuratMasukDb,
  deleteAgendaEventDb,
  deletePaketPekerjaanDb,
  deletePersonelDb,
  deleteSuratDb,
  ensureWorkspaceInitialized,
  isChunkedPdfUrl,
  loadPdfDataUrlFromFirestore,
  markAllNotifikasiReadDb,
  markNotifikasiReadDb,
  reactivateAgendaEventDb,
  rescheduleAgendaEventDb,
  saveAkunPasswordDb,
  subscribeAgendaEvents,
  subscribeAkunKredensial,
  subscribeNotifikasiDisposisi,
  subscribePaketPekerjaan,
  subscribePersonel,
  subscribeSuratMasuk,
  subscribeWorkspace,
  syncDisposisiNotificationsDb,
  updateAgendaEventDb,
  updateDisposisiDb,
  updatePaketPekerjaanDb,
  updatePaketPekerjaanTahapanDb,
  updatePersonelDb,
  updateStageOrCatatanDb,
  updateStatusSelesaiDb,
  updateSuratMasukDb,
  updateWorkspacePejabatDb,
  uploadSuratKeluarDb,
} from './services/firestoreService';

const AUTH_ACCOUNT_STORAGE_KEY = 'sipantau_auth_account_id';
const AUTH_LAST_ACTIVITY_STORAGE_KEY = 'sipantau_last_activity_at';
const IDLE_EXPIRED_NOTICE = 'Sesi Anda berakhir. Silakan masuk kembali.';

export default function App() {
  // Firestore Workspace Loading State
  const [dbReady, setDbReady] = useState(false);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  if (asyncError) {
    throw asyncError;
  }

  // Real-time Firestore-backed state
  const [suratList, setSuratList] = useState<SuratMasuk[]>([]);
  const [agendaList, setAgendaList] = useState<AgendaEvent[]>([]);
  const [paketPekerjaanList, setPaketPekerjaanList] = useState<PaketPekerjaan[]>([]);
  const [notifikasiList, setNotifikasiList] = useState<NotifikasiDisposisi[]>([]);
  const [personelList, setPersonelList] = useState<Personel[]>(INITIAL_PERSONEL);
  const [pejabatConfig, setPejabatConfig] = useState<PejabatConfig>(INITIAL_PEJABAT);
  const [akunKredensialMap, setAkunKredensialMap] = useState<Record<string, AkunKredensial>>({});
  const [highlightedSuratId, setHighlightedSuratId] = useState<string | null>(null);

  // Authenticated logged-in account (with automatic 30-minute idle expiration check on boot)
  const [initialBootExpired] = useState<boolean>(() => {
    try {
      const savedId = localStorage.getItem(AUTH_ACCOUNT_STORAGE_KEY) || '';
      if (!savedId) return false;
      const lastAct = parseStoredTimestamp(localStorage.getItem(AUTH_LAST_ACTIVITY_STORAGE_KEY));
      if (isSessionIdleExpired(lastAct, Date.now(), IDLE_TIMEOUT_MS)) {
        localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
        localStorage.removeItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const [loggedInAccountId, setLoggedInAccountId] = useState<string>(() => {
    if (initialBootExpired) return '';
    try {
      return localStorage.getItem(AUTH_ACCOUNT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [sessionNotice, setSessionNotice] = useState<string | null>(
    initialBootExpired ? IDLE_EXPIRED_NOTICE : null
  );
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);

  const lastActivityRef = useRef<number>((() => {
    try {
      const stored = parseStoredTimestamp(localStorage.getItem(AUTH_LAST_ACTIVITY_STORAGE_KEY));
      return stored || Date.now();
    } catch {
      return Date.now();
    }
  })());
  const lastPersistedActivityRef = useRef<number>(lastActivityRef.current);

  const loginAccounts = buildLoginAccounts(pejabatConfig, personelList);
  const loggedInAccount: LoginAccount | null =
    loginAccounts.find((a) => a.id === loggedInAccountId) || null;

  const currentUser: Personel = loggedInAccount
    ? {
        id: loggedInAccount.id,
        nama: loggedInAccount.nama,
        nip: loggedInAccount.nip,
        jabatan: loggedInAccount.jabatan,
        peran: loggedInAccount.peran,
        isKetuaTim: loggedInAccount.peran === 'ketua_tim',
      }
    : personelList[0] || INITIAL_PERSONEL[0];
  const currentRole: Role = currentUser.peran;

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Resolve inline data URL or multi-chunk Firestore PDF payload for backup export
  const resolvePdfDataUrlForBackup = async (
    file: DokumenFile | undefined
  ): Promise<string | undefined> => {
    if (!file?.dataUrl) return undefined;
    if (isChunkedPdfUrl(file.dataUrl)) {
      return await loadPdfDataUrlFromFirestore(file.dataUrl);
    }
    return file.dataUrl;
  };

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTahap, setSelectedTahap] = useState<TahapTindakLanjutId | 'selesai' | 'perlu_disposisi' | 'aktif' | 'all'>('all');
  const [selectedPersonel, setSelectedPersonel] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'aktif' | 'selesai'>('all');

  // Modals state
  const [isModalSuratMasukOpen, setIsModalSuratMasukOpen] = useState(false);
  const [selectedSuratForEditId, setSelectedSuratForEditId] = useState<string | null>(null);
  const [isModalDisposisiOpen, setIsModalDisposisiOpen] = useState(false);
  const [selectedSuratForDisposisiId, setSelectedSuratForDisposisiId] = useState<string | null>(null);

  const [isModalTindakLanjutOpen, setIsModalTindakLanjutOpen] = useState(false);
  const [selectedSuratForTindakLanjutId, setSelectedSuratForTindakLanjutId] = useState<string | null>(null);

  const [isModalUploadSuratKeluarOpen, setIsModalUploadSuratKeluarOpen] = useState(false);
  const [selectedSuratForSuratKeluarId, setSelectedSuratForSuratKeluarId] = useState<string | null>(null);

  const [isModalPersonelOpen, setIsModalPersonelOpen] = useState(false);

  // Guard backup & personel tabs/modals strictly for full-access roles (ketua_tim & administrator)
  useEffect(() => {
    if (!canAccessBackup(currentRole) && activeTab === 'backup') {
      setActiveTab('dashboard');
    }
    if (!canManagePersonel(currentRole)) {
      if (activeTab === 'personel') {
        setActiveTab('dashboard');
      }
      if (isModalPersonelOpen) {
        setIsModalPersonelOpen(false);
      }
    }
  }, [currentRole, activeTab, isModalPersonelOpen]);

  const [isModalPdfViewerOpen, setIsModalPdfViewerOpen] = useState(false);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<DokumenFile | null>(null);

  const [isModalLembarDisposisiOpen, setIsModalLembarDisposisiOpen] = useState(false);
  const [selectedSuratForLembarId, setSelectedSuratForLembarId] = useState<string | null>(null);

  const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
  const [selectedSuratForDeleteId, setSelectedSuratForDeleteId] = useState<string | null>(null);

  const [isModalAgendaOpen, setIsModalAgendaOpen] = useState(false);
  const [selectedAgendaForEditId, setSelectedAgendaForEditId] = useState<string | null>(null);
  const [agendaInitialOpts, setAgendaInitialOpts] = useState<{
    date?: string;
    jamMulai?: string;
    jamSelesai?: string;
  }>({});

  const [isModalPaketOpen, setIsModalPaketOpen] = useState(false);
  const [selectedPaketForEditId, setSelectedPaketForEditId] = useState<string | null>(null);
  const [isModalWorkflowOpen, setIsModalWorkflowOpen] = useState(false);
  const [selectedPaketForWorkflowId, setSelectedPaketForWorkflowId] = useState<string | null>(null);
  const [isModalCetakPekerjaanOpen, setIsModalCetakPekerjaanOpen] = useState(false);
  const [cetakPekerjaanInit, setCetakPekerjaanInit] = useState<
    ModalCetakPekerjaanInitialState | undefined
  >(undefined);

  const selectedSuratForEdit = suratList.find((s) => s.id === selectedSuratForEditId) || null;
  const selectedSuratForDisposisi = suratList.find((s) => s.id === selectedSuratForDisposisiId) || null;
  const selectedSuratForTindakLanjut = suratList.find((s) => s.id === selectedSuratForTindakLanjutId) || null;
  const selectedSuratForSuratKeluar = suratList.find((s) => s.id === selectedSuratForSuratKeluarId) || null;
  const selectedSuratForLembar = suratList.find((s) => s.id === selectedSuratForLembarId) || null;
  const selectedSuratForDelete = suratList.find((s) => s.id === selectedSuratForDeleteId) || null;
  const selectedAgendaForEdit = agendaList.find((a) => a.id === selectedAgendaForEditId) || null;
  const selectedPaketForEdit = paketPekerjaanList.find((p) => p.id === selectedPaketForEditId) || null;
  const selectedPaketForWorkflow = paketPekerjaanList.find((p) => p.id === selectedPaketForWorkflowId) || null;

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Persist authenticated session locally and clear stale sessions if account is removed
  useEffect(() => {
    try {
      if (dbReady && loggedInAccountId && !loggedInAccount) {
        setLoggedInAccountId('');
        localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
        localStorage.removeItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
        return;
      }
      if (loggedInAccountId) {
        localStorage.setItem(AUTH_ACCOUNT_STORAGE_KEY, loggedInAccountId);
      } else {
        localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
        localStorage.removeItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [dbReady, loggedInAccountId, loggedInAccount]);

  // Initialize shared internal workspace and attach Firestore listeners directly on mount
  useEffect(() => {
    let cancelled = false;
    let unsubWorkspace: (() => void) | undefined;
    let unsubPersonel: (() => void) | undefined;
    let unsubAkun: (() => void) | undefined;
    let unsubSurat: (() => void) | undefined;
    let unsubAgenda: (() => void) | undefined;
    let unsubPekerjaan: (() => void) | undefined;
    let unsubNotifikasi: (() => void) | undefined;

    const readyFlags = {
      workspace: false,
      personel: false,
      akun: false,
      agenda: false,
      pekerjaan: false,
      surat: false,
      notifikasi: false,
    };
    const markReady = (key: keyof typeof readyFlags) => {
      if (cancelled || readyFlags[key]) return;
      readyFlags[key] = true;
      if (
        readyFlags.workspace &&
        readyFlags.personel &&
        readyFlags.akun &&
        readyFlags.agenda &&
        readyFlags.pekerjaan &&
        readyFlags.surat &&
        readyFlags.notifikasi
      ) {
        setDbReady(true);
      }
    };

    (async () => {
      try {
        await ensureWorkspaceInitialized();
        if (cancelled) return;

        unsubWorkspace = subscribeWorkspace(
          (cfg) => {
            setPejabatConfig(cfg);
            markReady('workspace');
          },
          (err) => setAsyncError(err)
        );
        unsubPersonel = subscribePersonel(
          (list) => {
            if (list.length > 0) setPersonelList(list);
            markReady('personel');
          },
          (err) => setAsyncError(err)
        );
        unsubAkun = subscribeAkunKredensial(
          (map) => {
            setAkunKredensialMap(map);
            markReady('akun');
          },
          (err) => setAsyncError(err)
        );
        unsubAgenda = subscribeAgendaEvents(
          (list) => {
            setAgendaList(list);
            markReady('agenda');
          },
          (err) => setAsyncError(err)
        );
        unsubPekerjaan = subscribePaketPekerjaan(
          (list) => {
            setPaketPekerjaanList(list);
            markReady('pekerjaan');
          },
          (err) => setAsyncError(err)
        );
        unsubSurat = subscribeSuratMasuk(
          (list) => {
            setSuratList(list);
            markReady('surat');
          },
          (err) => setAsyncError(err)
        );
        unsubNotifikasi = subscribeNotifikasiDisposisi(
          (list) => {
            setNotifikasiList(list);
            markReady('notifikasi');
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
      unsubAkun?.();
      unsubAgenda?.();
      unsubPekerjaan?.();
      unsubSurat?.();
      unsubNotifikasi?.();
    };
  }, []);

  // Notifications strictly scoped to the currently logged-in disposition recipient
  const accountNotifications = filterNotificationsForAccount(
    notifikasiList,
    loggedInAccount,
    suratList
  );
  const unreadNotificationsCount = countUnreadNotifications(accountNotifications);

  // Subtle live toast if a new unread disposition arrives for the active account while online
  const notifToastTrackerRef = useRef<{
    accountId: string;
    initialized: boolean;
    seenKeys: Set<string>;
  }>({ accountId: '', initialized: false, seenKeys: new Set() });

  useEffect(() => {
    if (!dbReady || !loggedInAccount) {
      notifToastTrackerRef.current = {
        accountId: '',
        initialized: false,
        seenKeys: new Set(),
      };
      return;
    }

    const tracker = notifToastTrackerRef.current;
    const currentKeys = new Set(
      accountNotifications.map((n) => `${n.id}:${n.updatedAt}:${n.dibaca}`)
    );

    if (tracker.accountId !== loggedInAccount.id || !tracker.initialized) {
      notifToastTrackerRef.current = {
        accountId: loggedInAccount.id,
        initialized: true,
        seenKeys: currentKeys,
      };
      return;
    }

    const incomingUnread = accountNotifications.find(
      (n) => !n.dibaca && !tracker.seenKeys.has(`${n.id}:${n.updatedAt}:${n.dibaca}`)
    );
    tracker.seenKeys = currentKeys;

    if (incomingUnread && incomingUnread.pengirimNama !== loggedInAccount.nama) {
      showToast(
        `Disposisi ${incomingUnread.jenis === 'disposisi_diperbarui' ? 'diperbarui' : 'baru'} untuk Anda: ${incomingUnread.asalSurat}`
      );
    }
  }, [dbReady, loggedInAccount?.id, loggedInAccount?.nama, accountNotifications]);

  // Clear row highlight automatically after 4 seconds
  useEffect(() => {
    if (!highlightedSuratId) return;
    const timer = window.setTimeout(() => setHighlightedSuratId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightedSuratId]);

  // Handler: Tambah Surat Masuk
  const handleAddSuratMasuk = async (suratData: Partial<SuratMasuk>) => {
    try {
      await createSuratMasukDb(suratData, pejabatConfig);
      showToast(`Surat Masuk dari "${suratData.asalSurat || '-'}" berhasil disimpan ke database.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Edit Registrasi Surat Masuk
  const handleUpdateSuratMasuk = async (suratId: string, suratData: Partial<SuratMasuk>) => {
    const item = suratList.find((s) => s.id === suratId);
    if (!item) return;
    if (item.statusSelesai) {
      showToast('Surat sudah berstatus Selesai. Buka kembali status terlebih dahulu untuk mengubah data registrasi.');
      return;
    }

    const newRiwayat = [
      ...item.riwayatTindakLanjut,
      {
        id: `r-${Date.now()}`,
        tahapId: item.tahapSaatIni,
        tahapNama: 'Pembaruan Data Registrasi Surat Masuk',
        tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
        aktor: currentUser.nama,
        catatan: `Data registrasi surat masuk diperbarui (No. ${suratData.nomorSurat || item.nomorSurat}, Asal: ${suratData.asalSurat || item.asalSurat}).`,
      },
    ];

    try {
      await updateSuratMasukDb(suratId, suratData, newRiwayat);
      showToast(`Data registrasi surat dari "${suratData.asalSurat || item.asalSurat}" berhasil diperbarui.`);
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
    if (!canCreateDisposisi(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak mengatur disposisi.');
      return;
    }
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
    const tenggatLabel = tenggatWaktu ? ` Tenggat: ${tenggatWaktu}.` : '';
    const newRiwayat = [
      ...item.riwayatTindakLanjut,
      {
        id: `r-${Date.now()}`,
        tahapId: newTahap,
        tahapNama: wasEditing ? 'Pembaruan Disposisi & Instruksi' : TAHAP_TINDAK_LANJUT[3].nama,
        tanggal: new Date().toISOString().replace('T', ' ').substring(0, 16),
        aktor: currentUser.nama,
        catatan: wasEditing
          ? `Disposisi dan instruksi diperbarui. Personel: ${penerimaNama.join(', ')}.${tenggatLabel} Instruksi: "${instruksi}"`
          : `Didisposisikan kepada: ${penerimaNama.join(', ')}.${tenggatLabel} Instruksi: "${instruksi}"`,
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
      const recipientsForNotif = penerimaIds.map((pid, idx) => {
        const matched = personelList.find((p) => p.id === pid);
        return {
          id: pid,
          nama: matched?.nama || penerimaNama[idx] || 'Personel Tim',
        };
      });
      await syncDisposisiNotificationsDb({
        suratId,
        recipients: recipientsForNotif,
        nomorSurat: item.nomorSurat,
        asalSurat: item.asalSurat,
        perihal: item.perihal,
        sifat: item.sifat,
        instruksiDisposisi: instruksi,
        tenggatWaktu,
        pengirimNama: currentUser.nama,
      });
      showToast(
        wasEditing
          ? `Perubahan disposisi, instruksi & tenggat waktu untuk ${penerimaNama.join(', ')} berhasil disimpan.`
          : `Disposisi berhasil diteruskan kepada ${penerimaNama.join(', ')}.`
      );
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Klik notifikasi disposisi -> tandai dibaca, arahkan ke surat terkait, buka modal tindak lanjut
  const handleClickNotification = async (notif: NotifikasiDisposisi) => {
    if (!notif.dibaca) {
      markNotifikasiReadDb(notif.id, true).catch((err) => {
        setAsyncError(err instanceof Error ? err : new Error(String(err)));
      });
    }

    const targetSurat = suratList.find((s) => s.id === notif.suratId);
    if (!targetSurat) {
      showToast('Surat terkait disposisi ini sudah tidak tersedia atau telah dihapus.');
      return;
    }

    setSearchQuery('');
    setSelectedTahap('all');
    setSelectedPersonel('all');
    setSelectedStatus('all');
    setActiveTab('dashboard');
    setHighlightedSuratId(targetSurat.id);
    setSelectedSuratForTindakLanjutId(targetSurat.id);
    setIsModalTindakLanjutOpen(true);
  };

  const handleMarkAllNotificationsRead = async () => {
    const unreadIds = accountNotifications.filter((n) => !n.dibaca).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await markAllNotifikasiReadDb(unreadIds);
      showToast('Semua notifikasi disposisi ditandai sudah dibaca.');
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
    if (!canAdvanceStage(currentRole, item.tahapSaatIni)) {
      showToast('Anda tidak memiliki wewenang untuk melanjutkan tahapan tindak lanjut ini.');
      return;
    }
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
    if (!isFullAccessRole(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak mengatur tahapan secara langsung.');
      return;
    }
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

  // Handler: Hapus Surat (Ketua Tim & Administrator)
  const handleConfirmDeleteSurat = async (suratId: string) => {
    if (!canDeleteSurat(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak menghapus surat.');
      return;
    }
    try {
      await deleteSuratDb(suratId);
      showToast('Surat berhasil dihapus dari database.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Personel Management & Dynamic Active User Sync
  const handleUpdatePejabat = async (newPejabat: PejabatConfig) => {
    if (!canManagePersonel(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak mengubah data pejabat penandatangan.');
      return;
    }
    try {
      await updateWorkspacePejabatDb(newPejabat);
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
    if (!canManagePersonel(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak menambah personel tim.');
      return;
    }
    try {
      const created = await createPersonelDb(pData);
      showToast(`Personel baru ${created.nama} berhasil ditambahkan (password awal: "wasdal").`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdatePersonel = async (id: string, updated: Partial<Personel>) => {
    if (!canManagePersonel(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak mengubah data personel.');
      return;
    }
    const target = personelList.find((p) => p.id === id);
    try {
      await updatePersonelDb(id, updated);
      const isKetuaAccount =
        updated.peran === 'ketua_tim' ||
        updated.isKetuaTim ||
        (updated.peran === undefined && (target?.peran === 'ketua_tim' || target?.isKetuaTim));
      if (isKetuaAccount) {
        await updateWorkspacePejabatDb({
          ...pejabatConfig,
          ketuaTim: {
            nama:
              (updated.nama ?? target?.nama ?? pejabatConfig.ketuaTim.nama).trim() ||
              pejabatConfig.ketuaTim.nama,
            nip:
              updated.nip !== undefined
                ? updated.nip.trim()
                : target?.nip ?? pejabatConfig.ketuaTim.nip,
            jabatan:
              (updated.jabatan ?? target?.jabatan ?? pejabatConfig.ketuaTim.jabatan).trim() ||
              pejabatConfig.ketuaTim.jabatan,
          },
        });
      }
      showToast('Data personel berhasil diperbarui di database.');
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeletePersonel = async (id: string) => {
    if (!canManagePersonel(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak menghapus data personel.');
      return;
    }
    const target = personelList.find((p) => p.id === id);
    try {
      await deletePersonelDb(id);
      if (loggedInAccountId === id) {
        setLoggedInAccountId('');
      }
      showToast(`Data personel ${target ? `"${target.nama}"` : ''} berhasil dihapus.`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const recordUserActivity = useCallback((forcePersist = false) => {
    const now = Date.now();
    lastActivityRef.current = now;
    setIdleWarningSeconds((prev) => (prev !== null ? null : prev));

    if (forcePersist || now - lastPersistedActivityRef.current >= 5000) {
      lastPersistedActivityRef.current = now;
      try {
        localStorage.setItem(AUTH_LAST_ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        // ignore localStorage errors
      }
    }
  }, []);

  const handleLoginSuccess = (account: LoginAccount) => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastPersistedActivityRef.current = now;
    try {
      localStorage.setItem(AUTH_ACCOUNT_STORAGE_KEY, account.id);
      localStorage.setItem(AUTH_LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // ignore localStorage errors
    }
    setSessionNotice(null);
    setIdleWarningSeconds(null);
    setLoggedInAccountId(account.id);
    setActiveTab('dashboard');
    showToast(`Selamat datang, ${account.nama} (${account.displayRole}).`);
  };

  const handleLogout = useCallback((reason: 'manual' | 'idle' = 'manual') => {
    try {
      localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY);
      localStorage.removeItem(AUTH_LAST_ACTIVITY_STORAGE_KEY);
    } catch {
      // ignore localStorage errors
    }
    setIdleWarningSeconds(null);
    setLoggedInAccountId('');
    setActiveTab('dashboard');
    setIsModalPersonelOpen(false);
    setIsModalSuratMasukOpen(false);
    setSelectedSuratForEditId(null);
    setIsModalDisposisiOpen(false);
    setSelectedSuratForDisposisiId(null);
    setIsModalTindakLanjutOpen(false);
    setSelectedSuratForTindakLanjutId(null);
    setIsModalUploadSuratKeluarOpen(false);
    setSelectedSuratForSuratKeluarId(null);
    setIsModalPdfViewerOpen(false);
    setSelectedFileForViewer(null);
    setIsModalLembarDisposisiOpen(false);
    setSelectedSuratForLembarId(null);
    setIsModalDeleteOpen(false);
    setSelectedSuratForDeleteId(null);
    setIsModalAgendaOpen(false);
    setSelectedAgendaForEditId(null);
    setIsModalPaketOpen(false);
    setSelectedPaketForEditId(null);
    setIsModalWorkflowOpen(false);
    setSelectedPaketForWorkflowId(null);
    if (reason === 'idle') {
      setSessionNotice(IDLE_EXPIRED_NOTICE);
      showToast('Sesi Anda berakhir. Silakan masuk kembali.');
    } else {
      setSessionNotice(null);
      showToast('Anda telah keluar dari akun.');
    }
  }, []);

  const logoutRef = useRef(handleLogout);
  useEffect(() => {
    logoutRef.current = handleLogout;
  }, [handleLogout]);

  // Monitor inactivity for ALL authenticated accounts (Ketua Tim, Administrator, Staf Wasdal)
  useEffect(() => {
    if (!dbReady || !loggedInAccount) return;

    // Seed stored timestamp if absent from pre-existing login, without forcing immediate logout
    try {
      const existingStored = parseStoredTimestamp(localStorage.getItem(AUTH_LAST_ACTIVITY_STORAGE_KEY));
      if (!existingStored) {
        const now = Date.now();
        lastActivityRef.current = now;
        lastPersistedActivityRef.current = now;
        localStorage.setItem(AUTH_LAST_ACTIVITY_STORAGE_KEY, String(now));
      }
    } catch {
      // ignore storage issues
    }

    const evaluateIdleState = () => {
      const now = Date.now();
      let latestActivity = lastActivityRef.current;
      try {
        const stored = parseStoredTimestamp(localStorage.getItem(AUTH_LAST_ACTIVITY_STORAGE_KEY));
        if (stored && stored > latestActivity) {
          latestActivity = stored;
          lastActivityRef.current = stored;
        }
      } catch {
        // ignore storage issues
      }

      if (isSessionIdleExpired(latestActivity, now, IDLE_TIMEOUT_MS)) {
        logoutRef.current('idle');
        return true;
      }

      const remaining = getIdleRemainingMs(latestActivity, now, IDLE_TIMEOUT_MS);
      if (remaining <= IDLE_WARNING_THRESHOLD_MS) {
        setIdleWarningSeconds(Math.max(1, Math.ceil(remaining / 1000)));
      } else {
        setIdleWarningSeconds((prev) => (prev !== null ? null : prev));
      }
      return false;
    };

    // Check immediately on mount/session attach
    if (evaluateIdleState()) return;

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
      'click',
    ];

    const onActivity = () => {
      recordUserActivity(false);
    };

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        evaluateIdleState();
      }
    };

    const onStorageSync = (e: StorageEvent) => {
      if (e.key === AUTH_ACCOUNT_STORAGE_KEY && !e.newValue) {
        logoutRef.current('manual');
        return;
      }
      if (e.key === AUTH_LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const synced = parseStoredTimestamp(e.newValue);
        if (synced && synced > lastActivityRef.current) {
          lastActivityRef.current = synced;
          lastPersistedActivityRef.current = synced;
          setIdleWarningSeconds(null);
        }
      }
    };

    for (const evt of activityEvents) {
      window.addEventListener(evt, onActivity, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('storage', onStorageSync);

    const intervalId = window.setInterval(evaluateIdleState, 1000);

    return () => {
      for (const evt of activityEvents) {
        window.removeEventListener(evt, onActivity, { capture: true });
      }
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('storage', onStorageSync);
      window.clearInterval(intervalId);
    };
  }, [dbReady, loggedInAccount?.id, recordUserActivity]);

  const handleSaveAgenda = async (
    payload: AgendaMutationPayload,
    editingId?: string
  ) => {
    if (editingId) {
      await updateAgendaEventDb(editingId, payload);
      showToast(`Agenda "${payload.judul}" berhasil diperbarui.`);
    } else {
      await createAgendaEventDb(payload, {
        id: currentUser.id,
        nama: currentUser.nama,
      });
      showToast(`Agenda "${payload.judul}" berhasil ditambahkan ke kalender.`);
    }
  };

  const handleDeleteAgenda = async (agendaId: string) => {
    const target = agendaList.find((a) => a.id === agendaId);
    await deleteAgendaEventDb(agendaId);
    showToast(
      `Agenda ${target ? `"${target.judul}"` : ''} berhasil dihapus dari kalender.`
    );
  };

  const handleCancelAgenda = async (agendaId: string, alasan?: string) => {
    const target = agendaList.find((a) => a.id === agendaId);
    await cancelAgendaEventDb(agendaId, currentUser.nama, alasan);
    showToast(
      `Agenda ${target ? `"${target.judul}"` : ''} ditandai berstatus Dibatalkan.`
    );
  };

  const handleRescheduleAgenda = async (
    agendaId: string,
    payload: AgendaReschedulePayload
  ) => {
    const target = agendaList.find((a) => a.id === agendaId);
    await rescheduleAgendaEventDb(agendaId, payload);
    showToast(
      `Agenda ${target ? `"${target.judul}"` : ''} dijadwalkan ulang ke ${payload.tanggal}.`
    );
  };

  const handleReactivateAgenda = async (agendaId: string) => {
    const target = agendaList.find((a) => a.id === agendaId);
    await reactivateAgendaEventDb(agendaId, currentUser.nama);
    showToast(
      `Agenda ${target ? `"${target.judul}"` : ''} diaktifkan kembali menjadi Terjadwal.`
    );
  };

  const handleSavePaketPekerjaan = async (
    payload: PaketPekerjaanMutationPayload,
    editingId?: string
  ) => {
    if (editingId) {
      await updatePaketPekerjaanDb(editingId, payload);
      showToast(`Paket pekerjaan "${payload.subKegiatan}" berhasil diperbarui.`);
    } else {
      await createPaketPekerjaanDb(payload, {
        id: currentUser.id,
        nama: currentUser.nama,
      });
      showToast(`Paket pekerjaan "${payload.subKegiatan}" berhasil disimpan.`);
    }
  };

  const handleSavePaketTahapan = async (
    paketId: string,
    tahapan: TahapPekerjaan[],
    tanggalSelesai?: string,
    pencairan?: {
      skemaPembayaran?: SkemaPembayaran;
      terminPencairan?: TerminPekerjaan[];
      statusPencairan?: 'Belum' | 'Sudah';
      mekanismePencairan?:
        | 'Langsung (LS)'
        | 'Ganti Uang Persediaan (GU)'
        | 'Tambahan Uang Persediaan (TU)';
    }
  ) => {
    const target = paketPekerjaanList.find((p) => p.id === paketId);
    await updatePaketPekerjaanTahapanDb(paketId, tahapan, tanggalSelesai, pencairan);
    showToast(
      `Progres tahapan ${target ? `"${target.subKegiatan}"` : 'paket pekerjaan'} berhasil diperbarui.`
    );
  };

  const handleDeletePaketPekerjaan = async (paketId: string) => {
    const target = paketPekerjaanList.find((p) => p.id === paketId);
    if (!target) return;
    await deletePaketPekerjaanDb(paketId);
    showToast(`Paket pekerjaan "${target.subKegiatan}" berhasil dihapus.`);
  };

  const handleSaveNewPassword = async (accountId: string, newHash: string) => {
    await saveAkunPasswordDb(accountId, newHash, false);
    showToast('Password akun Anda berhasil diperbarui.');
  };

  const handleResetAccountPassword = async (accountId: string, nama: string) => {
    if (!canManagePersonel(currentRole)) {
      showToast('Hanya Ketua Tim atau Administrator yang berhak mereset password akun personel.');
      return;
    }
    try {
      const defaultHash = await hashPassword(DEFAULT_INITIAL_PASSWORD);
      await saveAkunPasswordDb(accountId, defaultHash, true);
      showToast(`Password akun ${nama} dikembalikan ke password awal "wasdal".`);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Handler: Export CSV (mendukung hasil filter rekap beserta history lengkap)
  const handleExportCsv = async (
    customList?: SuratMasuk[],
    options?: { includeHistory?: boolean }
  ) => {
    const targetList = customList ?? suratList;
    const includeHistory = options?.includeHistory ?? true;
    const { buildRekapCsvContent } = await import('./utils/rekapLogic');
    const csvContent = buildRekapCsvContent(targetList, includeHistory);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Rekap_Persuratan_WASDAL_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`File CSV rekapitulasi (${targetList.length} surat) berhasil diunduh.`);
  };

  // Calculate filtered list and dashboard statistics
  const filteredList = filterSurat(suratList, {
    searchQuery,
    tahapId: selectedTahap,
    personelName: selectedPersonel,
    status: selectedStatus,
  });

  const dashboardStats = calculateDashboardStats(suratList, personelList);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-600 text-xs">
          <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Memuat data persuratan dari Cloud Firestore...</span>
        </div>
      </div>
    );
  }

  if (!loggedInAccount) {
    return (
      <>
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-700 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginPage
          accounts={loginAccounts}
          akunKredensialMap={akunKredensialMap}
          onLoginSuccess={handleLoginSuccess}
          sessionNotice={sessionNotice}
        />
      </>
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

      {/* 60-Second Pre-Logout Inactivity Warning Banner */}
      {idleWarningSeconds !== null && (
        <div
          role="alert"
          data-testid="idle-warning-banner"
          className="fixed bottom-5 left-5 right-5 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl shadow-xl p-3.5 flex items-center justify-between gap-3 text-xs print:hidden"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Tidak ada aktivitas terdeteksi</div>
              <div className="text-amber-800 tabular-nums">
                Akun akan logout otomatis dalam <span className="font-bold">{idleWarningSeconds} detik</span>.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => recordUserActivity(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold shrink-0 whitespace-nowrap"
          >
            Tetap Masuk
          </button>
        </div>
      )}

      {/* Top Navbar with Branding, Notification Bell & Authenticated Account Menu */}
      <Navbar
        currentRole={currentRole}
        currentAccount={loggedInAccount}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLogout={() => handleLogout('manual')}
        notifications={accountNotifications}
        unreadNotificationsCount={unreadNotificationsCount}
        suratList={suratList}
        onClickNotification={handleClickNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      {/* Main Container */}
      <main
        className={`flex-1 w-full max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 print:p-0 print:space-y-0 ${
          isModalLembarDisposisiOpen || isModalCetakPekerjaanOpen ? 'print:hidden' : ''
        }`}
      >
        
        {/* Role & Access Info Bar */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Akses Pengguna Aktif:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${
              isFullAccessRole(currentRole)
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              {loggedInAccount.nama} ({loggedInAccount.displayRole})
            </span>
            <span className="text-slate-400 hidden md:inline">·</span>
            <span className="text-slate-500 hidden md:inline">
              {isFullAccessRole(currentRole)
                ? 'Hak akses penuh: Disposisi, Asistensi, Hapus Surat, Manajemen Personel, dan Backup Arsip.'
                : `Hak akses ${loggedInAccount.displayRole}: Pemantauan tindak lanjut, registrasi, upload surat keluar & manajemen akun pribadi.`}
            </span>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <DashboardAgendaTicker
              agendaList={agendaList}
              onOpenEvent={(ev) => {
                setSelectedAgendaForEditId(ev.id);
                setAgendaInitialOpts({});
                setIsModalAgendaOpen(true);
              }}
              onOpenAgendaTab={() => setActiveTab('agenda')}
            />

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
                    Kelola disposisi, tindak lanjut persuratan, dan penerbitan surat keluar
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
                onOpenEditSurat={(s) => setSelectedSuratForEditId(s.id)}
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
                highlightedSuratId={highlightedSuratId}
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
              onOpenEditSurat={(s) => setSelectedSuratForEditId(s.id)}
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
              highlightedSuratId={highlightedSuratId}
            />
          </div>
        )}

        {/* VIEW 3: PERSONEL (KETUA TIM & ADMINISTRATOR) */}
        {activeTab === 'personel' && canManagePersonel(currentRole) && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Konfigurasi Data Personel Tim
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pengelolaan data Ketua Tim Pengawasan dan Pengendalian Perumahan, Administrator, serta Staf Wasdal
                  </p>
                </div>
                <button
                  onClick={() => setIsModalPersonelOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors shrink-0 self-start sm:self-auto"
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
                    Ketua Tim Wasdal (Pendisposisi)
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

              {/* List of Administrators (if any) */}
              {personelList.some((p) => p.peran === 'administrator') && (
                <div className="pt-2">
                  <h4 className="font-bold text-xs text-slate-800 mb-2">
                    Daftar Administrator ({personelList.filter((p) => p.peran === 'administrator').length} Personel · Akses Penuh):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 text-xs">
                    {personelList
                      .filter((p) => p.peran === 'administrator')
                      .map((adm) => (
                        <div key={adm.id} className="p-3 bg-amber-50/70 rounded-lg border border-amber-200 shadow-2xs">
                          <div className="font-bold text-slate-900">{adm.nama}</div>
                          <div className="text-[11px] text-amber-800 font-semibold">{adm.jabatan}</div>
                          {adm.nip && <div className="text-[10px] text-slate-500 font-mono mt-0.5">NIP. {adm.nip}</div>}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* List of staff members */}
              <div className="pt-2">
                <h4 className="font-bold text-xs text-slate-800 mb-2">
                  Daftar Staf Wasdal ({personelList.filter(p => p.peran === 'staf').length} Personel):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 text-xs">
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

        {/* VIEW 5: BACKUP ARSIP SURAT SELESAI (KHUSUS AKUN PENDISPOSISI) */}
        {activeTab === 'backup' && canAccessBackup(currentRole) && (
          <BackupView
            suratList={suratList}
            pejabatConfig={pejabatConfig}
            currentRole={currentRole}
            currentUser={currentUser}
            resolvePdfDataUrl={(file) => resolvePdfDataUrlForBackup(file)}
            onOpenDetail={(s) => {
              setSelectedSuratForTindakLanjutId(s.id);
              setIsModalTindakLanjutOpen(true);
            }}
            onNotify={showToast}
          />
        )}

        {/* VIEW 6: AKUN SAYA & UBAH PASSWORD */}
        {activeTab === 'akun' && (
          <AkunView
            currentAccount={loggedInAccount}
            credential={akunKredensialMap[loggedInAccount.id] || null}
            onSaveNewPassword={handleSaveNewPassword}
            onLogout={handleLogout}
          />
        )}

        {/* VIEW 7: KALENDER & AGENDA KEGIATAN */}
        {activeTab === 'agenda' && (
          <AgendaView
            agendaList={agendaList}
            personelList={personelList}
            pejabatConfig={pejabatConfig}
            currentUser={currentUser}
            onOpenCreate={(opts) => {
              setSelectedAgendaForEditId(null);
              setAgendaInitialOpts(opts || {});
              setIsModalAgendaOpen(true);
            }}
            onOpenEvent={(ev) => {
              setSelectedAgendaForEditId(ev.id);
              setAgendaInitialOpts({});
              setIsModalAgendaOpen(true);
            }}
            onNotify={showToast}
          />
        )}

        {/* VIEW 8: PEMANTAUAN KEGIATAN & PEKERJAAN */}
        {activeTab === 'pekerjaan' && (
          <PekerjaanView
            paketList={paketPekerjaanList}
            personelList={personelList}
            currentUser={currentUser}
            currentRole={currentRole}
            onOpenCreate={() => {
              setSelectedPaketForEditId(null);
              setIsModalPaketOpen(true);
            }}
            onOpenEdit={(paket) => {
              setSelectedPaketForEditId(paket.id);
              setIsModalPaketOpen(true);
            }}
            onOpenWorkflow={(paket) => {
              setSelectedPaketForWorkflowId(paket.id);
              setIsModalWorkflowOpen(true);
            }}
            onOpenPrint={(opts) => {
              setCetakPekerjaanInit({
                mode: opts.selectedPaketId ? 'kartu' : 'rekap',
                selectedPaketId: opts.selectedPaketId || 'all',
                tahunAnggaran: opts.tahunAnggaran,
                jenisPelaksanaan: opts.jenisPelaksanaan,
                skemaPembayaran: opts.skemaPembayaran,
                statusPencairan: opts.statusPencairan,
                status: opts.status,
                searchQuery: opts.searchQuery,
              });
              setIsModalCetakPekerjaanOpen(true);
            }}
            onDeletePaket={handleDeletePaketPekerjaan}
            onNotify={showToast}
          />
        )}

      </main>

      {/* ALL MODALS */}

      {/* 1. Modal Registrasi & Edit Surat Masuk */}
      {(isModalSuratMasukOpen || selectedSuratForEdit) && (
        <ModalSuratMasuk
          isOpen={isModalSuratMasukOpen || Boolean(selectedSuratForEdit)}
          initialSurat={selectedSuratForEdit}
          onClose={() => {
            setIsModalSuratMasukOpen(false);
            setSelectedSuratForEditId(null);
          }}
          onSave={(suratData) => {
            if (selectedSuratForEdit) {
              handleUpdateSuratMasuk(selectedSuratForEdit.id, suratData);
            } else {
              handleAddSuratMasuk(suratData);
            }
          }}
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
          onOpenEditSurat={(s) => setSelectedSuratForEditId(s.id)}
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

      {/* 5. Modal Manajemen Personel (Khusus Ketua Tim) */}
      {isModalPersonelOpen && canManagePersonel(currentRole) && (
        <ModalPersonel
          isOpen={isModalPersonelOpen}
          onClose={() => setIsModalPersonelOpen(false)}
          personelList={personelList}
          pejabatConfig={pejabatConfig}
          currentRole={currentRole}
          currentUser={currentUser}
          onUpdatePejabat={handleUpdatePejabat}
          onAddPersonel={handleAddPersonel}
          onUpdatePersonel={handleUpdatePersonel}
          onDeletePersonel={handleDeletePersonel}
          onResetPassword={handleResetAccountPassword}
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

      {/* 9. Modal Tambah / Edit Agenda Kegiatan */}
      {isModalAgendaOpen && (
        <ModalAgenda
          isOpen={isModalAgendaOpen}
          onClose={() => {
            setIsModalAgendaOpen(false);
            setSelectedAgendaForEditId(null);
            setAgendaInitialOpts({});
          }}
          initialEvent={selectedAgendaForEdit}
          initialDate={agendaInitialOpts.date}
          initialJamMulai={agendaInitialOpts.jamMulai}
          initialJamSelesai={agendaInitialOpts.jamSelesai}
          personelList={personelList}
          currentUser={currentUser}
          onSave={handleSaveAgenda}
          onCancelAgenda={handleCancelAgenda}
          onRescheduleAgenda={handleRescheduleAgenda}
          onReactivateAgenda={handleReactivateAgenda}
          onDelete={handleDeleteAgenda}
        />
      )}

      {/* 10. Modal Tambah / Edit Paket Pekerjaan & Template Tahapan */}
      {isModalPaketOpen && (
        <ModalPaketPekerjaan
          isOpen={isModalPaketOpen}
          onClose={() => {
            setIsModalPaketOpen(false);
            setSelectedPaketForEditId(null);
          }}
          initialPaket={selectedPaketForEdit}
          personelList={personelList}
          onSave={handleSavePaketPekerjaan}
          onDeletePaket={handleDeletePaketPekerjaan}
        />
      )}

      {/* 11. Modal Pemantauan & Update Progres Tahapan Pekerjaan */}
      {isModalWorkflowOpen && selectedPaketForWorkflow && (
        <ModalWorkflowTahapan
          isOpen={isModalWorkflowOpen}
          onClose={() => {
            setIsModalWorkflowOpen(false);
            setSelectedPaketForWorkflowId(null);
          }}
          paket={selectedPaketForWorkflow}
          currentUser={currentUser}
          onSaveProgress={handleSavePaketTahapan}
          onOpenEditPaket={(paket) => {
            setSelectedPaketForEditId(paket.id);
            setIsModalPaketOpen(true);
          }}
        />
      )}

      {/* 12. Modal Menu Cetak Pekerjaan (Rekap & Kartu Kendali) */}
      {isModalCetakPekerjaanOpen && (
        <ModalCetakPekerjaan
          isOpen={isModalCetakPekerjaanOpen}
          onClose={() => {
            setIsModalCetakPekerjaanOpen(false);
            setCetakPekerjaanInit(undefined);
          }}
          paketList={paketPekerjaanList}
          pejabatConfig={pejabatConfig}
          initialState={cetakPekerjaanInit}
          onNotify={showToast}
        />
      )}

    </div>
  );
}
