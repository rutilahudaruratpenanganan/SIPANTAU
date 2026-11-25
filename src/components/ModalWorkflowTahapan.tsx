import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  PaketPekerjaan,
  Personel,
  StatusTahapPekerjaan,
  TahapPekerjaan,
} from '../types';
import {
  computePaketProgress,
  createTahapId,
  formatRupiah,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  normalizeTahapanOrder,
} from '../utils/pekerjaanLogic';

interface ModalWorkflowTahapanProps {
  isOpen: boolean;
  onClose: () => void;
  paket: PaketPekerjaan | null;
  currentUser: Personel;
  onSaveProgress: (
    paketId: string,
    tahapan: TahapPekerjaan[],
    tanggalSelesai?: string
  ) => Promise<void>;
  onOpenEditPaket: (paket: PaketPekerjaan) => void;
}

export const ModalWorkflowTahapan: React.FC<ModalWorkflowTahapanProps> = ({
  isOpen,
  onClose,
  paket,
  currentUser,
  onSaveProgress,
  onOpenEditPaket,
}) => {
  const [tahapan, setTahapan] = useState<TahapPekerjaan[]>([]);
  const [tanggalSelesaiPaket, setTanggalSelesaiPaket] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !paket) return;
    setTahapan(paket.tahapan.map((t, idx) => ({ ...t, urutan: idx + 1 })));
    setTanggalSelesaiPaket(paket.tanggalSelesai || '');
    setNewStageName('');
    setIsSaving(false);
  }, [isOpen, paket]);

  if (!isOpen || !paket) return null;

  const todayIso = getTodayLocalIso();
  const liveProgress = computePaketProgress(
    {
      tahapan,
      tanggalMulai: paket.tanggalMulai,
      durasiHariKerja: paket.durasiHariKerja,
      tenggatWaktu: paket.tenggatWaktu,
      tanggalSelesai: tanggalSelesaiPaket || undefined,
    },
    todayIso
  );

  const handleSetStageStatus = (id: string, status: StatusTahapPekerjaan) => {
    const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTahapan((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status,
          tanggalSelesai: status === 'selesai' ? t.tanggalSelesai || todayIso : undefined,
          diperbaruiOleh: currentUser.nama,
          diperbaruiPada: nowStamp,
        };
      });
      const allDone = next.length > 0 && next.every((item) => item.status === 'selesai');
      if (allDone) {
        setTanggalSelesaiPaket((curr) => curr || todayIso);
      } else {
        setTanggalSelesaiPaket('');
      }
      return next;
    });
  };

  const handleUpdateStageField = (
    id: string,
    field: 'catatan' | 'tanggalTarget' | 'tanggalSelesai' | 'nama',
    value: string
  ) => {
    const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTahapan((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              [field]: value,
              diperbaruiOleh: currentUser.nama,
              diperbaruiPada: nowStamp,
            }
          : t
      )
    );
  };

  const handleAddQuickStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed || tahapan.length >= 30) return;
    setTahapan((prev) =>
      normalizeTahapanOrder([
        ...prev,
        {
          id: createTahapId(prev.length + 1),
          urutan: prev.length + 1,
          nama: trimmed,
          status: 'belum_mulai',
        },
      ])
    );
    setNewStageName('');
  };

  const handleRemoveStage = (id: string) => {
    if (tahapan.length <= 1) return;
    setTahapan((prev) => {
      const next = normalizeTahapanOrder(prev.filter((t) => t.id !== id));
      const allDone = next.length > 0 && next.every((item) => item.status === 'selesai');
      setTanggalSelesaiPaket(allDone ? tanggalSelesaiPaket || todayIso : '');
      return next;
    });
  };

  const handleSave = async () => {
    const cleaned = normalizeTahapanOrder(
      tahapan.map((t) => ({
        ...t,
        nama: t.nama.trim() || `Tahap ${t.urutan}`,
      }))
    );
    setIsSaving(true);
    try {
      await onSaveProgress(paket.id, cleaned, tanggalSelesaiPaket.trim() || undefined);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-workflow-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-workflow-title" className="text-sm sm:text-base font-bold truncate">
                Pemantauan Alur Tahapan Pekerjaan
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                {paket.namaKegiatan} · {paket.subKegiatan}
                {paket.pekerjaan ? ` · ${paket.pekerjaan}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditPaket(paket);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors whitespace-nowrap"
            >
              Edit Info Paket
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pemantauan tahapan"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
              <span className="font-semibold text-slate-900">{paket.jenisPelaksanaan}</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                TA {getPaketTahunAnggaran(paket)}
              </span>
              {paket.kodeRup && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono text-slate-700">RUP: {paket.kodeRup}</span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatRupiah(paket.nilaiAnggaran)}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono tabular-nums">
                Mulai {paket.tanggalMulai} · {liveProgress.durasiHariKerja} hari kalender → Selesai{' '}
                {paket.tenggatWaktu}
              </span>
              {paket.penyedia && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>Pelaksana: {paket.penyedia}</span>
                </>
              )}
            </div>

            <div className="font-mono font-bold text-slate-900 tabular-nums">
              {liveProgress.selesaiCount}/{liveProgress.totalTahapan} Tahap ·{' '}
              <span
                className={
                  liveProgress.overallStatus === 'selesai'
                    ? 'text-emerald-700'
                    : liveProgress.overallStatus === 'terlambat'
                    ? 'text-rose-700'
                    : 'text-blue-700'
                }
              >
                {liveProgress.persentase}% ({liveProgress.overallStatusLabel})
              </span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                liveProgress.overallStatus === 'selesai'
                  ? 'bg-emerald-600'
                  : liveProgress.overallStatus === 'terlambat'
                  ? 'bg-rose-600'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${liveProgress.persentase}%` }}
            />
          </div>
        </div>

        {/* Stages List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
          {tahapan.map((stage, idx) => {
            const isDone = stage.status === 'selesai';
            const isRunning = stage.status === 'sedang_berjalan';

            return (
              <div
                key={stage.id}
                data-testid={`progress-stage-card-${idx}`}
                className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                  isDone
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : isRunning
                    ? 'bg-blue-50/40 border-blue-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 tabular-nums ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isRunning
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isRunning ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <input
                      type="text"
                      aria-label={`Judul Tahap ${idx + 1}`}
                      value={stage.nama}
                      onChange={(e) => handleUpdateStageField(stage.id, 'nama', e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white bg-transparent font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  {/* Quick Status Segmented Buttons */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleSetStageStatus(stage.id, 'belum_mulai')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        stage.status === 'belum_mulai'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Circle className="w-3 h-3" />
                      <span>Belum</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStageStatus(stage.id, 'sedang_berjalan')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        stage.status === 'sedang_berjalan'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>Proses</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStageStatus(stage.id, 'selesai')}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        stage.status === 'selesai'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Selesai</span>
                    </button>
                    {tahapan.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(stage.id)}
                        aria-label={`Hapus tahap ${stage.nama}`}
                        title="Hapus tahapan ini"
                        className="p-1 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dates & Notes per Stage */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pl-0 sm:pl-9">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Target Tanggal
                    </label>
                    <input
                      type="date"
                      value={stage.tanggalTarget || ''}
                      onChange={(e) =>
                        handleUpdateStageField(stage.id, 'tanggalTarget', e.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white font-mono tabular-nums text-[11px] text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Tanggal Selesai Tahap
                    </label>
                    <input
                      type="date"
                      value={stage.tanggalSelesai || ''}
                      onChange={(e) =>
                        handleUpdateStageField(stage.id, 'tanggalSelesai', e.target.value)
                      }
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white font-mono tabular-nums text-[11px] text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Catatan / Nomor Dokumen Output
                    </label>
                    <input
                      type="text"
                      value={stage.catatan || ''}
                      onChange={(e) =>
                        handleUpdateStageField(stage.id, 'catatan', e.target.value)
                      }
                      placeholder="Contoh: No. BAST, catatan asistensi, atau dokumen pencairan"
                      className="w-full px-2.5 py-1 rounded-md border border-slate-300 bg-white text-[11px] text-slate-800"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick Add Custom Stage */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddQuickStage();
                }
              }}
              placeholder="Tambah tahapan baru secara manual (opsional)..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
            />
            <button
              type="button"
              onClick={handleAddQuickStage}
              disabled={!newStageName.trim() || tahapan.length >= 30}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Tahapan</span>
            </button>
          </div>
        </div>

        {/* Footer Summary & Save */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-600 font-mono tabular-nums text-[11px]">
            {liveProgress.overallStatus === 'selesai' ? (
              <span>
                Target Selesai: <strong className="text-slate-900">{paket.tenggatWaktu}</strong> ·
                Tuntas seluruh tahapan ({tanggalSelesaiPaket || todayIso})
              </span>
            ) : (
              <span>
                Durasi:{' '}
                <strong className="text-slate-900">
                  {liveProgress.durasiHariKerja} hari kalender
                </strong>{' '}
                · Tanggal Selesai (Otomatis):{' '}
                <strong className="text-slate-900">{paket.tenggatWaktu}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Progres Tahapan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
