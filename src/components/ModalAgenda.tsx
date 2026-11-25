import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  MapPin,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AgendaEvent, AgendaKategori, Personel } from '../types';
import {
  AgendaMutationPayload,
  AgendaReschedulePayload,
} from '../services/firestoreService';
import {
  AGENDA_KATEGORI_LIST,
  formatIndonesianDateFull,
  getAgendaStatusLabel,
  getKategoriStyle,
  minutesToHhmm,
  normalizeAgendaStatus,
  timeToMinutes,
  validateAgendaInput,
  validateRescheduleInput,
} from '../utils/agendaLogic';

interface ModalAgendaProps {
  isOpen: boolean;
  onClose: () => void;
  initialEvent: AgendaEvent | null;
  initialDate?: string;
  initialJamMulai?: string;
  initialJamSelesai?: string;
  personelList: Personel[];
  currentUser: Personel;
  onSave: (payload: AgendaMutationPayload, editingId?: string) => Promise<void>;
  onCancelAgenda?: (agendaId: string, alasan?: string) => Promise<void>;
  onRescheduleAgenda?: (
    agendaId: string,
    payload: AgendaReschedulePayload
  ) => Promise<void>;
  onReactivateAgenda?: (agendaId: string) => Promise<void>;
  onDelete?: (agendaId: string) => Promise<void>;
}

const LOKASI_PRESETS = [
  'Ruang Rapat DPKP',
  'Ruang Bidang Perumahan',
  'Tinjauan Lapangan',
  'Daring / Zoom Meeting',
];

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const ModalAgenda: React.FC<ModalAgendaProps> = ({
  isOpen,
  onClose,
  initialEvent,
  initialDate,
  initialJamMulai,
  initialJamSelesai,
  personelList,
  currentUser,
  onSave,
  onCancelAgenda,
  onRescheduleAgenda,
  onReactivateAgenda,
  onDelete,
}) => {
  const isEditing = Boolean(initialEvent);
  const currentStatus = normalizeAgendaStatus(initialEvent?.status);

  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState<AgendaKategori>('Rapat Koordinasi');
  const [tanggal, setTanggal] = useState(getTodayIso());
  const [sepanjangHari, setSepanjangHari] = useState(false);
  const [jamMulai, setJamMulai] = useState('09:00');
  const [jamSelesai, setJamSelesai] = useState('10:00');
  const [lokasi, setLokasi] = useState('');
  const [pesertaIds, setPesertaIds] = useState<string[]>([]);
  const [pesertaTambahan, setPesertaTambahan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [personelSearch, setPersonelSearch] = useState('');

  // Status Action Mode: cancel or reschedule
  const [actionMode, setActionMode] = useState<'none' | 'cancel' | 'reschedule'>('none');
  const [cancelReason, setCancelReason] = useState('');

  const [rescheduleTanggal, setRescheduleTanggal] = useState('');
  const [rescheduleSepanjangHari, setRescheduleSepanjangHari] = useState(false);
  const [rescheduleJamMulai, setRescheduleJamMulai] = useState('09:00');
  const [rescheduleJamSelesai, setRescheduleJamSelesai] = useState('10:00');
  const [rescheduleLokasi, setRescheduleLokasi] = useState('');
  const [rescheduleAlasan, setRescheduleAlasan] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingStatus, setIsMutatingStatus] = useState(false);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      setJudul(initialEvent.judul);
      setKategori(initialEvent.kategori);
      setTanggal(initialEvent.tanggal);
      setSepanjangHari(initialEvent.sepanjangHari);
      setJamMulai(initialEvent.jamMulai || '09:00');
      setJamSelesai(initialEvent.jamSelesai || '10:00');
      setLokasi(initialEvent.lokasi || '');
      setPesertaIds(initialEvent.pesertaIds || []);
      setPesertaTambahan(initialEvent.pesertaTambahan || '');
      setCatatan(initialEvent.catatan || '');

      setRescheduleTanggal(initialEvent.tanggal);
      setRescheduleSepanjangHari(initialEvent.sepanjangHari);
      setRescheduleJamMulai(initialEvent.jamMulai || '09:00');
      setRescheduleJamSelesai(initialEvent.jamSelesai || '10:00');
      setRescheduleLokasi(initialEvent.lokasi || '');
      setRescheduleAlasan('');
      setCancelReason(
        initialEvent.status === 'dibatalkan' ? initialEvent.alasanStatus || '' : ''
      );
    } else {
      const defDate = initialDate || getTodayIso();
      setJudul('');
      setKategori('Rapat Koordinasi');
      setTanggal(defDate);
      setSepanjangHari(false);
      setJamMulai(initialJamMulai || '09:00');
      setJamSelesai(initialJamSelesai || '10:00');
      setLokasi('');
      setPesertaIds(currentUser?.id ? [currentUser.id] : []);
      setPesertaTambahan('');
      setCatatan('');
      setRescheduleTanggal(defDate);
      setRescheduleSepanjangHari(false);
      setRescheduleJamMulai(initialJamMulai || '09:00');
      setRescheduleJamSelesai(initialJamSelesai || '10:00');
      setRescheduleLokasi('');
      setRescheduleAlasan('');
      setCancelReason('');
    }
    setActionMode('none');
    setPersonelSearch('');
    setErrorMessage('');
    setIsSaving(false);
    setIsMutatingStatus(false);
    setConfirmDeleteStep(false);
    setIsDeleting(false);
  }, [isOpen, initialEvent?.id, initialDate, initialJamMulai, initialJamSelesai, currentUser?.id]);

  if (!isOpen) return null;

  const isBusy = isSaving || isDeleting || isMutatingStatus;

  const togglePeserta = (id: string) => {
    setErrorMessage('');
    setPesertaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const applyDurationMinutes = (durationMin: number) => {
    const startMin = timeToMinutes(jamMulai || '09:00');
    const nextEnd = Math.min(23 * 60 + 59, startMin + durationMin);
    setJamSelesai(minutesToHhmm(nextEnd));
  };

  const openReschedulePanel = () => {
    if (!initialEvent) return;
    setRescheduleTanggal(initialEvent.tanggal);
    setRescheduleSepanjangHari(initialEvent.sepanjangHari);
    setRescheduleJamMulai(initialEvent.jamMulai || '09:00');
    setRescheduleJamSelesai(initialEvent.jamSelesai || '10:00');
    setRescheduleLokasi(initialEvent.lokasi || '');
    setRescheduleAlasan('');
    setErrorMessage('');
    setConfirmDeleteStep(false);
    setActionMode((prev) => (prev === 'reschedule' ? 'none' : 'reschedule'));
  };

  const openCancelPanel = () => {
    setErrorMessage('');
    setConfirmDeleteStep(false);
    setActionMode((prev) => (prev === 'cancel' ? 'none' : 'cancel'));
  };

  const filteredPersonel = personelList.filter((p) => {
    if (!personelSearch.trim()) return true;
    const q = personelSearch.toLowerCase();
    return p.nama.toLowerCase().includes(q) || p.jabatan.toLowerCase().includes(q);
  });

  const getRoleShortLabel = (peran: Personel['peran']) => {
    if (peran === 'ketua_tim') return 'Ketua Tim';
    if (peran === 'administrator') return 'Administrator';
    return 'Staf Wasdal';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    const validationError = validateAgendaInput({
      judul,
      tanggal,
      sepanjangHari,
      jamMulai,
      jamSelesai,
      lokasi,
      pesertaIds,
      pesertaTambahan,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const selectedObjects = personelList.filter((p) => pesertaIds.includes(p.id));
    const finalIds = selectedObjects.map((p) => p.id);
    const finalNama = selectedObjects.map((p) => p.nama);

    const payload: AgendaMutationPayload = {
      judul: judul.trim(),
      kategori,
      tanggal: tanggal.trim(),
      sepanjangHari,
      jamMulai: sepanjangHari ? '00:00' : jamMulai,
      jamSelesai: sepanjangHari ? '23:59' : jamSelesai,
      lokasi: lokasi.trim(),
      pesertaIds: finalIds,
      pesertaNama: finalNama,
      pesertaTambahan: pesertaTambahan.trim() || undefined,
      catatan: catatan.trim() || undefined,
    };

    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSave(payload, initialEvent?.id);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan agenda kegiatan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCancelAgenda = async () => {
    if (!initialEvent || !onCancelAgenda || isBusy) return;
    setIsMutatingStatus(true);
    setErrorMessage('');
    try {
      await onCancelAgenda(initialEvent.id, cancelReason.trim() || undefined);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal membatalkan agenda kegiatan.'
      );
    } finally {
      setIsMutatingStatus(false);
    }
  };

  const handleConfirmRescheduleAgenda = async () => {
    if (!initialEvent || !onRescheduleAgenda || isBusy) return;

    const validationError = validateRescheduleInput({
      currentTanggal: initialEvent.tanggal,
      currentSepanjangHari: initialEvent.sepanjangHari,
      currentJamMulai: initialEvent.jamMulai,
      currentJamSelesai: initialEvent.jamSelesai,
      currentLokasi: initialEvent.lokasi,
      currentStatus: initialEvent.status,
      newTanggal: rescheduleTanggal,
      newSepanjangHari: rescheduleSepanjangHari,
      newJamMulai: rescheduleJamMulai,
      newJamSelesai: rescheduleJamSelesai,
      newLokasi: rescheduleLokasi,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsMutatingStatus(true);
    setErrorMessage('');
    try {
      await onRescheduleAgenda(initialEvent.id, {
        previousTanggal: initialEvent.tanggal,
        tanggal: rescheduleTanggal.trim(),
        sepanjangHari: rescheduleSepanjangHari,
        jamMulai: rescheduleSepanjangHari ? '00:00' : rescheduleJamMulai,
        jamSelesai: rescheduleSepanjangHari ? '23:59' : rescheduleJamSelesai,
        lokasi: rescheduleLokasi.trim(),
        alasan: rescheduleAlasan.trim() || undefined,
        actorNama: currentUser.nama,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menjadwalkan ulang agenda kegiatan.'
      );
    } finally {
      setIsMutatingStatus(false);
    }
  };

  const handleReactivate = async () => {
    if (!initialEvent || !onReactivateAgenda || isBusy) return;
    setIsMutatingStatus(true);
    setErrorMessage('');
    try {
      await onReactivateAgenda(initialEvent.id);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mengaktifkan kembali agenda.'
      );
    } finally {
      setIsMutatingStatus(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialEvent || !onDelete || isBusy) return;
    setIsDeleting(true);
    setErrorMessage('');
    try {
      await onDelete(initialEvent.id);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menghapus agenda kegiatan.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-agenda-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="modal-agenda-title"
                className="text-sm sm:text-base font-bold text-slate-900 truncate"
              >
                {isEditing ? 'Detail & Edit Agenda Kegiatan' : 'Buat Agenda Kegiatan Baru'}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {isEditing
                  ? `Dibuat oleh ${initialEvent?.dibuatOlehNama || 'Tim Wasdal'}`
                  : 'Jadwalkan agenda rapat, asistensi, audiensi, dan tinjauan lapangan Tim Wasdal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            aria-label="Tutup modal agenda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="agenda-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Status & Quick Schedule Actions (Only when inspecting/editing an existing agenda) */}
          {isEditing && initialEvent && (
            <div
              data-testid="agenda-status-bar"
              className={`rounded-xl border p-3.5 space-y-3 ${
                currentStatus === 'dibatalkan'
                  ? 'bg-rose-50/70 border-rose-200'
                  : currentStatus === 'dijadwalkan_ulang'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-600">Status Agenda:</span>
                    <span
                      data-testid="agenda-current-status-label"
                      className={`font-bold ${
                        currentStatus === 'dibatalkan'
                          ? 'text-rose-700'
                          : currentStatus === 'dijadwalkan_ulang'
                          ? 'text-amber-800'
                          : 'text-emerald-700'
                      }`}
                    >
                      {getAgendaStatusLabel(initialEvent.status)}
                    </span>
                    {initialEvent.tanggalSebelumnya && currentStatus === 'dijadwalkan_ulang' && (
                      <span className="text-[11px] text-slate-600 tabular-nums">
                        · Dipindah dari {formatIndonesianDateFull(initialEvent.tanggalSebelumnya)}
                      </span>
                    )}
                  </div>
                  {initialEvent.alasanStatus && (
                    <p className="text-[11px] text-slate-700">
                      Keterangan: <span className="font-medium">{initialEvent.alasanStatus}</span>
                    </p>
                  )}
                  {initialEvent.statusDiubahOleh && (
                    <p className="text-[10px] text-slate-500">
                      Diperbarui oleh {initialEvent.statusDiubahOleh}
                      {initialEvent.statusDiubahPada ? ` · ${initialEvent.statusDiubahPada}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {onRescheduleAgenda && (
                    <button
                      type="button"
                      data-testid="open-reschedule-agenda-btn"
                      onClick={openReschedulePanel}
                      disabled={isBusy}
                      aria-expanded={actionMode === 'reschedule'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                        actionMode === 'reschedule'
                          ? 'bg-amber-700 border-amber-700 text-white'
                          : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-50'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Jadwalkan Ulang</span>
                    </button>
                  )}

                  {currentStatus !== 'dibatalkan' && onCancelAgenda && (
                    <button
                      type="button"
                      data-testid="open-cancel-agenda-btn"
                      onClick={openCancelPanel}
                      disabled={isBusy}
                      aria-expanded={actionMode === 'cancel'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                        actionMode === 'cancel'
                          ? 'bg-rose-700 border-rose-700 text-white'
                          : 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Batalkan Agenda</span>
                    </button>
                  )}

                  {currentStatus === 'dibatalkan' && onReactivateAgenda && (
                    <button
                      type="button"
                      data-testid="reactivate-agenda-btn"
                      onClick={handleReactivate}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Aktifkan Kembali</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Panel: Batalkan Agenda (tidak menghapus, ubah status menjadi Dibatalkan) */}
              {actionMode === 'cancel' && (
                <div
                  data-testid="agenda-cancel-panel"
                  className="pt-3 border-t border-rose-200 space-y-2.5"
                >
                  <p className="text-[11px] text-rose-900 font-medium">
                    Agenda tidak dihapus dari kalender, melainkan tetap tercatat dengan status{' '}
                    <span className="font-bold">Dibatalkan</span>.
                  </p>
                  <div>
                    <label
                      htmlFor="agenda-cancel-reason"
                      className="block font-semibold text-slate-700 mb-1"
                    >
                      Alasan Pembatalan (Opsional)
                    </label>
                    <input
                      id="agenda-cancel-reason"
                      type="text"
                      maxLength={500}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Contoh: Kegiatan ditunda / Narasumber berhalangan hadir..."
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionMode('none')}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-cancel-agenda-btn"
                      onClick={handleConfirmCancelAgenda}
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 whitespace-nowrap"
                    >
                      {isMutatingStatus ? 'Membatalkan...' : 'Konfirmasi Batalkan'}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Panel: Jadwalkan Ulang (pindah ke hari baru yang dipilih) */}
              {actionMode === 'reschedule' && (
                <div
                  data-testid="agenda-reschedule-panel"
                  className="pt-3 border-t border-amber-200 space-y-3"
                >
                  <p className="text-[11px] text-amber-950 font-medium">
                    Pilih tanggal jadwal ulang baru. Agenda akan otomatis berpindah di kalender ke hari yang dipilih dengan status{' '}
                    <span className="font-bold">Dijadwalkan Ulang</span>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agenda-reschedule-tanggal"
                        className="block font-semibold text-slate-700 mb-1"
                      >
                        Tanggal Jadwal Ulang <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="agenda-reschedule-tanggal"
                        type="date"
                        value={rescheduleTanggal}
                        onChange={(e) => {
                          setRescheduleTanggal(e.target.value);
                          setErrorMessage('');
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                      />
                    </div>

                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={rescheduleSepanjangHari}
                          onChange={(e) => {
                            setRescheduleSepanjangHari(e.target.checked);
                            setErrorMessage('');
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-semibold text-slate-700">Sepanjang Hari</span>
                      </label>
                    </div>
                  </div>

                  {!rescheduleSepanjangHari && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="agenda-reschedule-jam-mulai"
                          className="block font-semibold text-slate-700 mb-1"
                        >
                          Waktu Mulai Baru (WIB)
                        </label>
                        <input
                          id="agenda-reschedule-jam-mulai"
                          type="time"
                          value={rescheduleJamMulai}
                          onChange={(e) => {
                            setRescheduleJamMulai(e.target.value);
                            setErrorMessage('');
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="agenda-reschedule-jam-selesai"
                          className="block font-semibold text-slate-700 mb-1"
                        >
                          Waktu Selesai Baru (WIB)
                        </label>
                        <input
                          id="agenda-reschedule-jam-selesai"
                          type="time"
                          value={rescheduleJamSelesai}
                          onChange={(e) => {
                            setRescheduleJamSelesai(e.target.value);
                            setErrorMessage('');
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="agenda-reschedule-lokasi"
                        className="block font-semibold text-slate-700 mb-1"
                      >
                        Lokasi Kegiatan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="agenda-reschedule-lokasi"
                        type="text"
                        maxLength={250}
                        value={rescheduleLokasi}
                        onChange={(e) => {
                          setRescheduleLokasi(e.target.value);
                          setErrorMessage('');
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="agenda-reschedule-alasan"
                        className="block font-semibold text-slate-700 mb-1"
                      >
                        Keterangan Jadwal Ulang (Opsional)
                      </label>
                      <input
                        id="agenda-reschedule-alasan"
                        type="text"
                        maxLength={500}
                        value={rescheduleAlasan}
                        onChange={(e) => setRescheduleAlasan(e.target.value)}
                        placeholder="Contoh: Penyesuaian jadwal pimpinan..."
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionMode('none')}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-reschedule-agenda-btn"
                      onClick={handleConfirmRescheduleAgenda}
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold disabled:opacity-50 whitespace-nowrap"
                    >
                      {isMutatingStatus ? 'Memindahkan...' : 'Simpan Jadwal Ulang'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Judul Agenda */}
          <div>
            <label
              htmlFor="agenda-judul-input"
              className="block font-semibold text-slate-700 mb-1.5"
            >
              Judul Agenda Kegiatan <span className="text-rose-500">*</span>
            </label>
            <input
              id="agenda-judul-input"
              type="text"
              maxLength={200}
              value={judul}
              onChange={(e) => {
                setJudul(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Contoh: Rapat Koordinasi Evaluasi Pengelolaan PPPSRS Apartemen..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            />
          </div>

          {/* Kategori Kegiatan */}
          <div>
            <span className="block font-semibold text-slate-700 mb-1.5">
              Kategori Kegiatan
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {AGENDA_KATEGORI_LIST.map((kat) => {
                const st = getKategoriStyle(kat);
                const active = kategori === kat;
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setKategori(kat)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-all whitespace-nowrap ${
                      active
                        ? `${st.bg} ${st.border} ${st.text} font-bold ring-1 ring-inset ring-current/25`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-xs shrink-0 ${st.dot}`} />
                    <span className="truncate text-[11px]">{kat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tanggal & Waktu */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <label
                  htmlFor="agenda-tanggal-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                </label>
                <input
                  id="agenda-tanggal-input"
                  type="date"
                  value={tanggal}
                  onChange={(e) => {
                    setTanggal(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                />
              </div>

              <label className="flex items-center gap-2 pt-2 sm:pt-5 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={sepanjangHari}
                  onChange={(e) => {
                    setSepanjangHari(e.target.checked);
                    setErrorMessage('');
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700">Sepanjang Hari</span>
              </label>
            </div>

            {!sepanjangHari && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/80">
                <div>
                  <label
                    htmlFor="agenda-jam-mulai"
                    className="flex items-center gap-1 font-semibold text-slate-700 mb-1"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Waktu Mulai (WIB)</span>
                  </label>
                  <input
                    id="agenda-jam-mulai"
                    type="time"
                    value={jamMulai}
                    onChange={(e) => {
                      setJamMulai(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="agenda-jam-selesai"
                      className="font-semibold text-slate-700"
                    >
                      Waktu Selesai (WIB)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyDurationMinutes(60)}
                        className="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-600 whitespace-nowrap"
                      >
                        +1j
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDurationMinutes(120)}
                        className="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-600 whitespace-nowrap"
                      >
                        +2j
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDurationMinutes(180)}
                        className="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-600 whitespace-nowrap"
                      >
                        +3j
                      </button>
                    </div>
                  </div>
                  <input
                    id="agenda-jam-selesai"
                    type="time"
                    value={jamSelesai}
                    onChange={(e) => {
                      setJamSelesai(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Lokasi / Tempat */}
          <div>
            <label
              htmlFor="agenda-lokasi-input"
              className="flex items-center gap-1 font-semibold text-slate-700 mb-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Lokasi / Tempat Kegiatan <span className="text-rose-500">*</span></span>
            </label>
            <input
              id="agenda-lokasi-input"
              type="text"
              maxLength={250}
              value={lokasi}
              onChange={(e) => {
                setLokasi(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Contoh: Ruang Rapat Lantai 2 DPKP / Lokasi Perumahan..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {LOKASI_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setLokasi(preset);
                    setErrorMessage('');
                  }}
                  className={`px-2 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap ${
                    lokasi === preset
                      ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Personel yang Menghadiri */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-800">
                  Personel yang Menghadiri <span className="text-rose-500">*</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-[10px] tabular-nums">
                  {pesertaIds.length} dipilih
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPesertaIds(personelList.map((p) => p.id));
                    setErrorMessage('');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setPesertaIds([])}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            {personelList.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={personelSearch}
                  onChange={(e) => setPersonelSearch(e.target.value)}
                  placeholder="Cari nama personel..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredPersonel.map((p) => {
                const selected = pesertaIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePeserta(p.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors ${
                      selected
                        ? 'bg-blue-50/90 border-blue-300 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                        selected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{p.nama}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium whitespace-nowrap">
                          {getRoleShortLabel(p.peran)}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">{p.jabatan}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Peserta Tambahan / Instansi Terkait */}
          <div>
            <label
              htmlFor="agenda-peserta-tambahan"
              className="flex items-center gap-1 font-semibold text-slate-700 mb-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Peserta Tambahan / Eksternal (Opsional)</span>
            </label>
            <input
              id="agenda-peserta-tambahan"
              type="text"
              maxLength={300}
              value={pesertaTambahan}
              onChange={(e) => {
                setPesertaTambahan(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Contoh: Kepala Bidang Perumahan, Perwakilan Pengembang, Warga..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            />
          </div>

          {/* Catatan */}
          <div>
            <label
              htmlFor="agenda-catatan"
              className="block font-semibold text-slate-700 mb-1"
            >
              Catatan / Agenda Pembahasan (Opsional)
            </label>
            <textarea
              id="agenda-catatan"
              rows={3}
              maxLength={1500}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Tuliskan poin pembahasan, perlengkapan yang perlu dibawa, atau keterangan tambahan..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 resize-y"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            {isEditing && onDelete && (
              confirmDeleteStep ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isBusy}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteStep(false)}
                    disabled={isBusy}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-medium whitespace-nowrap"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActionMode('none');
                    setConfirmDeleteStep(true);
                  }}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Agenda</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors whitespace-nowrap"
            >
              {isEditing ? 'Tutup' : 'Batal'}
            </button>
            <button
              type="submit"
              form="agenda-form"
              disabled={isBusy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving
                ? 'Menyimpan...'
                : isEditing
                ? 'Simpan Perubahan'
                : 'Simpan Agenda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

