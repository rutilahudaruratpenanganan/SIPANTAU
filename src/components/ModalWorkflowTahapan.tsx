import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  MekanismePencairan,
  PaketPekerjaan,
  Personel,
  SkemaPembayaran,
  StatusPencairan,
  StatusTahapPekerjaan,
  TahapPekerjaan,
  TerminPekerjaan,
} from '../types';
import {
  MAX_TERMIN_PEKERJAAN,
  MEKANISME_PENCAIRAN_LIST,
  SKEMA_PEMBAYARAN_LIST,
  STATUS_PENCAIRAN_LIST,
  buildDefaultTerminPencairan,
  computePaketProgress,
  createTahapId,
  createTerminId,
  formatRupiah,
  formatTanggalDisplay,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  normalizeTahapanOrder,
  normalizeTerminOrder,
  parseRupiahInput,
  resolvePaketTanggalSelesai,
  resolveStatusPencairanFromTermin,
  summarizeTerminPencairan,
} from '../utils/pekerjaanLogic';

interface ModalWorkflowTahapanProps {
  isOpen: boolean;
  onClose: () => void;
  paket: PaketPekerjaan | null;
  currentUser: Personel;
  onSaveProgress: (
    paketId: string,
    tahapan: TahapPekerjaan[],
    tanggalSelesai?: string,
    pencairan?: {
      skemaPembayaran?: SkemaPembayaran;
      terminPencairan?: TerminPekerjaan[];
      statusPencairan?: StatusPencairan;
      mekanismePencairan?: MekanismePencairan;
    }
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
  const [skemaPembayaran, setSkemaPembayaran] = useState<SkemaPembayaran>('Sekaligus');
  const [terminPencairan, setTerminPencairan] = useState<TerminPekerjaan[]>([]);
  const [statusPencairan, setStatusPencairan] = useState<StatusPencairan>('Belum');
  const [mekanismePencairan, setMekanismePencairan] = useState<MekanismePencairan | ''>('');
  const [newStageName, setNewStageName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !paket) return;
    const initSkemaBayar: SkemaPembayaran =
      paket.skemaPembayaran === 'Termin' ||
      (Array.isArray(paket.terminPencairan) && paket.terminPencairan.length > 0)
        ? 'Termin'
        : 'Sekaligus';
    setTahapan(paket.tahapan.map((t, idx) => ({ ...t, urutan: idx + 1 })));
    setTanggalSelesaiPaket(paket.tanggalSelesai || '');
    setSkemaPembayaran(initSkemaBayar);
    setTerminPencairan(
      initSkemaBayar === 'Termin'
        ? normalizeTerminOrder(
            paket.terminPencairan && paket.terminPencairan.length > 0
              ? paket.terminPencairan
              : buildDefaultTerminPencairan()
          )
        : []
    );
    setStatusPencairan(paket.statusPencairan || 'Belum');
    setMekanismePencairan(paket.mekanismePencairan || '');
    setNewStageName('');
    setErrorMessage('');
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
    setTanggalSelesaiPaket('');
    setNewStageName('');
  };

  const handleMoveStage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= tahapan.length) return;
    setTahapan((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return normalizeTahapanOrder(next);
    });
  };

  const handleRemoveStage = (id: string) => {
    if (tahapan.length <= 1) return;
    setTahapan((prev) => {
      const next = normalizeTahapanOrder(prev.filter((t) => t.id !== id));
      setTanggalSelesaiPaket(
        resolvePaketTanggalSelesai(next, tanggalSelesaiPaket, todayIso) || ''
      );
      return next;
    });
  };

  const handleChangeSkemaPembayaran = (next: SkemaPembayaran) => {
    setSkemaPembayaran(next);
    if (next === 'Termin' && terminPencairan.length === 0) {
      setTerminPencairan(buildDefaultTerminPencairan());
    }
  };

  const handleUpdateTermin = (id: string, patch: Partial<TerminPekerjaan>) => {
    setTerminPencairan((prev) =>
      prev.map((tr) => {
        if (tr.id !== id) return tr;
        const updated: TerminPekerjaan = { ...tr, ...patch };
        if (patch.status === 'Sudah' && !updated.tanggalCair) {
          updated.tanggalCair = todayIso;
        } else if (patch.status === 'Belum') {
          updated.tanggalCair = undefined;
        }
        return updated;
      })
    );
  };

  const handleAddTermin = () => {
    if (terminPencairan.length >= MAX_TERMIN_PEKERJAAN) return;
    setTerminPencairan((prev) =>
      normalizeTerminOrder([
        ...prev,
        {
          id: createTerminId(prev.length + 1),
          urutan: prev.length + 1,
          nama: `Termin ${prev.length + 1}`,
          status: 'Belum',
        },
      ])
    );
  };

  const handleRemoveTermin = (id: string) => {
    if (terminPencairan.length <= 1) return;
    setTerminPencairan((prev) => normalizeTerminOrder(prev.filter((tr) => tr.id !== id)));
  };

  const terminSummary = summarizeTerminPencairan({
    skemaPembayaran,
    statusPencairan,
    terminPencairan,
  });

  const handleSave = async () => {
    const cleaned = normalizeTahapanOrder(
      tahapan.map((t) => ({
        ...t,
        nama: t.nama.trim() || `Tahap ${t.urutan}`,
      }))
    );
    const cleanedTermins =
      skemaPembayaran === 'Termin' ? normalizeTerminOrder(terminPencairan) : undefined;
    const resolvedStatusPencairan = resolveStatusPencairanFromTermin(
      skemaPembayaran,
      statusPencairan,
      cleanedTermins
    );
    const resolvedTanggalSelesai = resolvePaketTanggalSelesai(
      cleaned,
      tanggalSelesaiPaket,
      todayIso
    );
    setErrorMessage('');
    setIsSaving(true);
    try {
      await onSaveProgress(paket.id, cleaned, resolvedTanggalSelesai, {
        skemaPembayaran,
        terminPencairan: cleanedTermins,
        statusPencairan: resolvedStatusPencairan,
        mekanismePencairan: mekanismePencairan || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan tahapan ke database.'
      );
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
                Edit Per Tahap Pekerjaan
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors whitespace-nowrap"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Keseluruhan</span>
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
              {paket.skemaKontrak && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-semibold text-indigo-700">{paket.skemaKontrak}</span>
                </>
              )}
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
                Pagu: {formatRupiah(paket.nilaiAnggaran)}
              </span>
              {typeof paket.nilaiKontrak === 'number' && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    Kontrak: {formatRupiah(paket.nilaiKontrak)}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="tabular-nums">
                Mulai {formatTanggalDisplay(paket.tanggalMulai)} · {liveProgress.durasiHariKerja}{' '}
                hari kalender → Selesai {formatTanggalDisplay(paket.tenggatWaktu)}
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
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Skema Pembayaran, Status & Termin Pencairan */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="workflow-skema-pembayaran"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Skema Pembayaran
                </label>
                <select
                  id="workflow-skema-pembayaran"
                  value={skemaPembayaran}
                  onChange={(e) =>
                    handleChangeSkemaPembayaran(e.target.value as SkemaPembayaran)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {SKEMA_PEMBAYARAN_LIST.map((sk) => (
                    <option key={sk} value={sk}>
                      {sk === 'Sekaligus' ? 'Sekaligus (Tanpa Termin)' : 'Bertahap (Termin)'}
                    </option>
                  ))}
                </select>
              </div>

              {skemaPembayaran === 'Sekaligus' ? (
                <div>
                  <label
                    htmlFor="workflow-status-pencairan"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Tahapan Pencairan
                  </label>
                  <select
                    id="workflow-status-pencairan"
                    value={statusPencairan}
                    onChange={(e) => setStatusPencairan(e.target.value as StatusPencairan)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {STATUS_PENCAIRAN_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <div className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Ringkasan Termin Cair
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 font-semibold text-xs tabular-nums">
                    {terminSummary.summaryLabel} ({terminSummary.totalPersenCair}%)
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="workflow-mekanisme-pencairan"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Mekanisme Pencairan
                </label>
                <select
                  id="workflow-mekanisme-pencairan"
                  value={mekanismePencairan}
                  onChange={(e) =>
                    setMekanismePencairan(e.target.value as MekanismePencairan | '')
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Pilih Mekanisme Pencairan --</option>
                  {MEKANISME_PENCAIRAN_LIST.map((mek) => (
                    <option key={mek} value={mek}>
                      {mek}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {skemaPembayaran === 'Termin' && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800">
                    Rincian Termin Pembayaran ({terminPencairan.length} Termin)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddTermin}
                    disabled={terminPencairan.length >= MAX_TERMIN_PEKERJAAN}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white text-[11px] font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Termin</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {terminPencairan.map((tr, idx) => (
                    <div
                      key={tr.id}
                      data-testid={`workflow-termin-row-${idx}`}
                      className="p-2 rounded-lg border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-3 flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-indigo-700 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          aria-label={`Nama Termin ${idx + 1}`}
                          value={tr.nama}
                          onChange={(e) =>
                            handleUpdateTermin(tr.id, { nama: e.target.value })
                          }
                          className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Persen Termin ${idx + 1}`}
                          value={tr.persentase ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            handleUpdateTermin(tr.id, {
                              persentase: raw === '' ? undefined : Number(raw),
                            });
                          }}
                          placeholder="%"
                          className="w-full px-1.5 py-1 rounded border border-slate-300 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Nilai Termin ${idx + 1}`}
                          value={
                            typeof tr.nilaiRupiah === 'number'
                              ? tr.nilaiRupiah.toLocaleString('id-ID')
                              : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            handleUpdateTermin(tr.id, {
                              nilaiRupiah: raw === '' ? undefined : parseRupiahInput(raw),
                            });
                          }}
                          placeholder="Nilai Rp"
                          className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          aria-label={`Status Pencairan Termin ${idx + 1}`}
                          value={tr.status}
                          onChange={(e) =>
                            handleUpdateTermin(tr.id, {
                              status: e.target.value as StatusPencairan,
                            })
                          }
                          className={`w-full px-2 py-1 rounded border text-[11px] font-semibold ${
                            tr.status === 'Sudah'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-white text-slate-800'
                          }`}
                        >
                          {STATUS_PENCAIRAN_LIST.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="date"
                          aria-label={`Tanggal Cair Termin ${idx + 1}`}
                          title="Tanggal cair (opsional)"
                          value={tr.tanggalCair || ''}
                          onChange={(e) =>
                            handleUpdateTermin(tr.id, {
                              tanggalCair: e.target.value || undefined,
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-[11px] text-slate-700"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveTermin(tr.id)}
                          disabled={terminPencairan.length <= 1}
                          aria-label={`Hapus termin ${idx + 1}`}
                          className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-35"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                    <div className="flex items-center gap-0.5 pl-1 border-l border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Naikkan urutan tahap ${idx + 1}`}
                        title="Naikkan urutan"
                        className="p-1 rounded-md text-slate-600 hover:bg-white disabled:opacity-35"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, 1)}
                        disabled={idx === tahapan.length - 1}
                        aria-label={`Turunkan urutan tahap ${idx + 1}`}
                        title="Turunkan urutan"
                        className="p-1 rounded-md text-slate-600 hover:bg-white disabled:opacity-35"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
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
          <div className="text-slate-600 tabular-nums text-[11px]">
            {liveProgress.overallStatus === 'selesai' ? (
              <span>
                Target Selesai:{' '}
                <strong className="text-slate-900">{formatTanggalDisplay(paket.tenggatWaktu)}</strong> ·
                Tuntas seluruh tahapan ({formatTanggalDisplay(tanggalSelesaiPaket || todayIso)})
              </span>
            ) : (
              <span>
                Durasi:{' '}
                <strong className="text-slate-900">
                  {liveProgress.durasiHariKerja} hari kalender
                </strong>{' '}
                · Tanggal Selesai (Otomatis):{' '}
                <strong className="text-slate-900">{formatTanggalDisplay(paket.tenggatWaktu)}</strong>
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
