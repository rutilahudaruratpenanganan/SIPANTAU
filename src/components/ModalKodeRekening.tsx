import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Check,
  Copy,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { PaketPekerjaan, RekeningAnggaran } from '../types';
import { RekeningAnggaranMutationPayload } from '../services/firestoreService';
import {
  MAX_TAHUN_ANGGARAN,
  MIN_TAHUN_ANGGARAN,
  RolloverRekeningCandidate,
  buildRolloverRekeningPreview,
  formatRupiah,
  getTodayLocalIso,
  parseRupiahInput,
  summarizeRekeningAnggaran,
  validateRekeningAnggaranInput,
} from '../utils/pekerjaanLogic';

interface ModalKodeRekeningProps {
  isOpen: boolean;
  onClose: () => void;
  rekeningList: RekeningAnggaran[];
  paketList: PaketPekerjaan[];
  onSaveRekening: (
    payload: RekeningAnggaranMutationPayload,
    editingId?: string
  ) => Promise<void>;
  onRolloverRekening?: (
    items: RekeningAnggaranMutationPayload[]
  ) => Promise<RekeningAnggaran[]>;
  onDeleteRekening: (rekeningId: string) => Promise<void>;
}

export const ModalKodeRekening: React.FC<ModalKodeRekeningProps> = ({
  isOpen,
  onClose,
  rekeningList,
  paketList,
  onSaveRekening,
  onRolloverRekening,
  onDeleteRekening,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const currentYear = new Date().getFullYear();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [kodeRekening, setKodeRekening] = useState('');
  const [uraian, setUraian] = useState('');
  const [tahunText, setTahunText] = useState(String(currentYear));
  const [paguAnggaran, setPaguAnggaran] = useState<number>(0);
  const [paguText, setPaguText] = useState('');
  const [catatan, setCatatan] = useState('');
  const [filterTahun, setFilterTahun] = useState<number | 'all'>('all');

  const [showRolloverPanel, setShowRolloverPanel] = useState(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState<number>(currentYear);
  const [rolloverTargetYearText, setRolloverTargetYearText] = useState<string>(
    String(currentYear + 1)
  );
  const [rolloverCopyPagu, setRolloverCopyPagu] = useState(true);
  const [rolloverCandidates, setRolloverCandidates] = useState<RolloverRekeningCandidate[]>([]);
  const [rolloverSkippedCount, setRolloverSkippedCount] = useState(0);
  const [rolloverSourceCount, setRolloverSourceCount] = useState(0);
  const [isRollingOver, setIsRollingOver] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const r of rekeningList) {
      years.add(r.tahunAnggaran);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [rekeningList]);

  const resetForm = () => {
    setEditingId(null);
    setKodeRekening('');
    setUraian('');
    setTahunText(String(currentYear));
    setPaguAnggaran(0);
    setPaguText('');
    setCatatan('');
    setErrorMessage('');
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    setFilterTahun('all');
    setShowRolloverPanel(false);
    setIsRollingOver(false);
    setConfirmDeleteId(null);
    setIsDeletingId(null);
  }, [isOpen]);

  // Rebuild rollover draft candidates whenever panel params change
  useEffect(() => {
    if (!showRolloverPanel) return;
    const parsedTarget = Number(rolloverTargetYearText.trim());
    const preview = buildRolloverRekeningPreview(
      rekeningList,
      rolloverSourceYear,
      Number.isInteger(parsedTarget) ? parsedTarget : NaN,
      rolloverCopyPagu
    );
    setRolloverCandidates(preview.candidates);
    setRolloverSkippedCount(preview.skippedExistingCount);
    setRolloverSourceCount(preview.sourceCount);
  }, [showRolloverPanel, rekeningList, rolloverSourceYear, rolloverTargetYearText, rolloverCopyPagu]);

  const summaries = useMemo(
    () => summarizeRekeningAnggaran(rekeningList, paketList, todayIso),
    [rekeningList, paketList, todayIso]
  );

  const filteredSummaries = useMemo(
    () =>
      filterTahun === 'all'
        ? summaries
        : summaries.filter((s) => s.rekening.tahunAnggaran === filterTahun),
    [summaries, filterTahun]
  );

  if (!isOpen) return null;

  const handleOpenRollover = () => {
    const defaultSource =
      typeof filterTahun === 'number'
        ? filterTahun
        : availableYears[0] ?? currentYear;
    setRolloverSourceYear(defaultSource);
    setRolloverTargetYearText(String(Math.min(MAX_TAHUN_ANGGARAN, defaultSource + 1)));
    setRolloverCopyPagu(true);
    setErrorMessage('');
    setShowRolloverPanel((v) => !v);
  };

  const handleRolloverToggleCandidate = (sourceId: string) => {
    setRolloverCandidates((prev) =>
      prev.map((c) => (c.sourceRekeningId === sourceId ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleRolloverPaguChange = (sourceId: string, raw: string) => {
    const parsed = raw.trim() === '' ? 0 : parseRupiahInput(raw);
    setRolloverCandidates((prev) =>
      prev.map((c) => (c.sourceRekeningId === sourceId ? { ...c, paguAnggaran: parsed } : c))
    );
  };

  const handleCommitRollover = async () => {
    if (!onRolloverRekening) return;
    const parsedTarget = Number(rolloverTargetYearText.trim());
    if (
      !Number.isInteger(parsedTarget) ||
      parsedTarget < MIN_TAHUN_ANGGARAN ||
      parsedTarget > MAX_TAHUN_ANGGARAN
    ) {
      setErrorMessage(
        `Tahun Anggaran tujuan harus berupa tahun valid (${MIN_TAHUN_ANGGARAN}–${MAX_TAHUN_ANGGARAN}).`
      );
      return;
    }
    if (parsedTarget === rolloverSourceYear) {
      setErrorMessage('TA Tujuan harus berbeda dengan TA Sumber.');
      return;
    }

    const chosen = rolloverCandidates.filter((c) => c.selected);
    if (chosen.length === 0) {
      setErrorMessage('Pilih minimal 1 Kode Rekening untuk disalin ke Tahun Anggaran tujuan.');
      return;
    }

    for (const item of chosen) {
      const err = validateRekeningAnggaranInput(
        {
          kodeRekening: item.kodeRekening,
          uraian: item.uraian,
          tahunAnggaran: parsedTarget,
          paguAnggaran: item.paguAnggaran,
        },
        rekeningList
      );
      if (err) {
        setErrorMessage(err);
        return;
      }
    }

    setErrorMessage('');
    setIsRollingOver(true);
    try {
      await onRolloverRekening(
        chosen.map((item) => ({
          kodeRekening: item.kodeRekening.trim(),
          uraian: item.uraian.trim(),
          tahunAnggaran: parsedTarget,
          paguAnggaran: item.paguAnggaran,
          catatan: item.catatan,
        }))
      );
      setShowRolloverPanel(false);
      setFilterTahun(parsedTarget);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyalin Kode Rekening ke Tahun Anggaran tujuan.'
      );
    } finally {
      setIsRollingOver(false);
    }
  };

  const handlePaguChange = (raw: string) => {
    if (raw.trim() === '') {
      setPaguAnggaran(0);
      setPaguText('');
      return;
    }
    const parsed = parseRupiahInput(raw);
    setPaguAnggaran(parsed);
    setPaguText(parsed.toLocaleString('id-ID'));
  };

  const handleStartEdit = (rek: RekeningAnggaran) => {
    setEditingId(rek.id);
    setKodeRekening(rek.kodeRekening);
    setUraian(rek.uraian);
    setTahunText(String(rek.tahunAnggaran));
    setPaguAnggaran(rek.paguAnggaran);
    setPaguText(rek.paguAnggaran.toLocaleString('id-ID'));
    setCatatan(rek.catatan || '');
    setErrorMessage('');
    setConfirmDeleteId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTahun = Number(tahunText.trim());
    const validationErr = validateRekeningAnggaranInput(
      {
        kodeRekening,
        uraian,
        tahunAnggaran: Number.isInteger(parsedTahun) ? parsedTahun : NaN,
        paguAnggaran,
      },
      rekeningList,
      editingId || undefined
    );

    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setErrorMessage('');
    setIsSaving(true);
    try {
      await onSaveRekening(
        {
          kodeRekening: kodeRekening.trim(),
          uraian: uraian.trim(),
          tahunAnggaran: parsedTahun,
          paguAnggaran,
          catatan: catatan.trim() || undefined,
        },
        editingId || undefined
      );
      resetForm();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan data Kode Rekening.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (rekeningId: string) => {
    setErrorMessage('');
    setIsDeletingId(rekeningId);
    try {
      await onDeleteRekening(rekeningId);
      setConfirmDeleteId(null);
      if (editingId === rekeningId) {
        resetForm();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menghapus Kode Rekening.'
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  const selectedRolloverCount = rolloverCandidates.filter((c) => c.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-kode-rekening-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2
                id="modal-kode-rekening-title"
                className="text-sm sm:text-base font-bold truncate"
              >
                Master Kode Rekening &amp; Pagu Anggaran Per Tahun
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Berlaku per Tahun Anggaran (DPA-SKPD / SIPD Permendagri 90/2019): 1 Kode Rekening per TA = 1 Pagu Anggaran
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kelola kode rekening"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Add / Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                {editingId ? 'Edit Kode Rekening & Pagu Anggaran' : 'Tambah Kode Rekening Baru'}
              </h3>
              <div className="flex items-center gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline"
                  >
                    Batal Edit
                  </button>
                )}
                {!editingId && onRolloverRekening && availableYears.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenRollover}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                      showRolloverPanel
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-indigo-300 text-indigo-800 hover:bg-indigo-50'
                    }`}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>
                      {showRolloverPanel
                        ? 'Tutup Salin Tahun Berikutnya'
                        : 'Salin ke Tahun Berikutnya'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label
                  htmlFor="rekening-kode-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kode Rekening <span className="text-rose-600">*</span>
                </label>
                <input
                  id="rekening-kode-input"
                  type="text"
                  required
                  maxLength={100}
                  value={kodeRekening}
                  onChange={(e) => setKodeRekening(e.target.value)}
                  placeholder="Contoh: 5.1.02.02.01.0029"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="rekening-uraian-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Uraian / Nama Rekening <span className="text-rose-600">*</span>
                </label>
                <input
                  id="rekening-uraian-input"
                  type="text"
                  required
                  maxLength={300}
                  value={uraian}
                  onChange={(e) => setUraian(e.target.value)}
                  placeholder="Contoh: Belanja Jasa Konsultansi Pengawasan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="rekening-tahun-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tahun Anggaran <span className="text-rose-600">*</span>
                </label>
                <input
                  id="rekening-tahun-input"
                  type="number"
                  required
                  min={MIN_TAHUN_ANGGARAN}
                  max={MAX_TAHUN_ANGGARAN}
                  step={1}
                  value={tahunText}
                  onChange={(e) => setTahunText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="rekening-pagu-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pagu Anggaran Rekening (Rp) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="rekening-pagu-input"
                    type="text"
                    inputMode="numeric"
                    required
                    value={paguText}
                    onChange={(e) => handlePaguChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  Terbaca: {formatRupiah(paguAnggaran)} (berlaku 1x untuk seluruh kegiatan pada TA ini)
                </p>
              </div>

              <div className="sm:col-span-7">
                <label
                  htmlFor="rekening-catatan-input"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Catatan / Keterangan DPA (Opsional)
                </label>
                <input
                  id="rekening-catatan-input"
                  type="text"
                  maxLength={1000}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: DPA Sub Kegiatan Penyelenggaraan Perumahan TA 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold shadow-xs transition-colors"
              >
                {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : editingId
                    ? 'Simpan Perubahan Rekening'
                    : 'Simpan Kode Rekening'}
                </span>
              </button>
            </div>
          </form>

          {/* Annual Rollover / Carry-Forward DPA Panel */}
          {showRolloverPanel && onRolloverRekening && availableYears.length > 0 && (
            <div
              data-testid="rollover-rekening-panel"
              className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Copy className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Salin Struktur Kode Rekening ke Tahun Anggaran Baru (Penyusunan DPA Tahunan)
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Struktur Kode Rekening dari TA sebelumnya dapat diteruskan ke TA baru tanpa mengetik ulang, lalu Pagu Anggaran disesuaikan mengikuti DPA tahun berjalan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label
                    htmlFor="rollover-source-year"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    TA Sumber
                  </label>
                  <select
                    id="rollover-source-year"
                    value={String(rolloverSourceYear)}
                    onChange={(e) => {
                      const nextSrc = Number(e.target.value);
                      setRolloverSourceYear(nextSrc);
                      setRolloverTargetYearText(String(Math.min(MAX_TAHUN_ANGGARAN, nextSrc + 1)));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold text-slate-900"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        TA {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1 hidden sm:flex items-center justify-center pb-2 text-slate-400">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="rollover-target-year"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    TA Tujuan <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="rollover-target-year"
                    type="number"
                    min={MIN_TAHUN_ANGGARAN}
                    max={MAX_TAHUN_ANGGARAN}
                    step={1}
                    value={rolloverTargetYearText}
                    onChange={(e) => setRolloverTargetYearText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-semibold tabular-nums text-slate-900"
                  />
                </div>

                <div className="sm:col-span-5 pb-1">
                  <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rolloverCopyPagu}
                      onChange={(e) => setRolloverCopyPagu(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <span>Bawa pagu TA {rolloverSourceYear} sebagai pagu awal (bisa diedit di bawah)</span>
                  </label>
                </div>
              </div>

              {rolloverSkippedCount > 0 && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {rolloverSkippedCount} kode rekening dari TA {rolloverSourceYear} sudah terdaftar di TA{' '}
                  {rolloverTargetYearText} dan dilewati otomatis agar tidak duplikat.
                </div>
              )}

              {rolloverCandidates.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-indigo-200 bg-white text-center text-slate-500 text-[11px]">
                  {rolloverSourceCount === 0
                    ? `Belum ada Kode Rekening di TA ${rolloverSourceYear}.`
                    : Number(rolloverTargetYearText) === rolloverSourceYear
                    ? 'Pilih TA Tujuan yang berbeda dengan TA Sumber.'
                    : `Seluruh Kode Rekening TA ${rolloverSourceYear} sudah tersedia di TA ${rolloverTargetYearText}.`}
                </div>
              ) : (
                <>
                  <div className="border border-indigo-200 rounded-xl bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <th className="py-2 px-2.5 w-8 text-center">Pilih</th>
                            <th className="py-2 px-2.5">Kode Rekening &amp; Uraian</th>
                            <th className="py-2 px-2.5 text-right">Pagu TA {rolloverSourceYear}</th>
                            <th className="py-2 px-2.5 text-right w-52">
                              Pagu Baru TA {rolloverTargetYearText} (Rp)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rolloverCandidates.map((cand) => (
                            <tr key={cand.sourceRekeningId} className="hover:bg-slate-50/70">
                              <td className="py-2 px-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={cand.selected}
                                  aria-label={`Pilih salin ${cand.kodeRekening}`}
                                  onChange={() => handleRolloverToggleCandidate(cand.sourceRekeningId)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                                />
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="font-mono font-bold text-slate-900">
                                  {cand.kodeRekening}
                                </div>
                                <div className="text-slate-600">{cand.uraian}</div>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                                {formatRupiah(cand.sourcePaguAnggaran)}
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">
                                    Rp
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Pagu TA ${rolloverTargetYearText} untuk ${cand.kodeRekening}`}
                                    disabled={!cand.selected}
                                    value={
                                      cand.paguAnggaran > 0
                                        ? cand.paguAnggaran.toLocaleString('id-ID')
                                        : '0'
                                    }
                                    onChange={(e) =>
                                      handleRolloverPaguChange(
                                        cand.sourceRekeningId,
                                        e.target.value
                                      )
                                    }
                                    className="w-full pl-7 pr-2 py-1 rounded-md border border-slate-300 bg-white disabled:bg-slate-100 text-right font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRolloverPanel(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitRollover}
                      disabled={isRollingOver || selectedRolloverCount === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold shadow-xs transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isRollingOver
                          ? 'Menyimpan...'
                          : `Simpan ${selectedRolloverCount} Rekening ke TA ${rolloverTargetYearText}`}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* List of Master Kode Rekening */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Daftar Kode Rekening Terdaftar ({filteredSummaries.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total Pagu hanya dihitung 1x per Kode Rekening dalam Tahun Anggaran tersebut meskipun digunakan oleh banyak kegiatan.
                </p>
              </div>

              {availableYears.length > 0 && (
                <select
                  aria-label="Filter tahun kode rekening"
                  value={filterTahun === 'all' ? 'all' : String(filterTahun)}
                  onChange={(e) =>
                    setFilterTahun(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-mono font-semibold text-slate-800 self-start sm:self-auto"
                >
                  <option value="all">Semua TA ({summaries.length})</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      TA {yr}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filteredSummaries.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                Belum ada Kode Rekening yang terdaftar. Gunakan formulir di atas untuk menambahkan Kode Rekening &amp; Pagu Anggaran.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Kode Rekening &amp; Uraian</th>
                        <th className="py-2.5 px-2 text-center">TA</th>
                        <th className="py-2.5 px-2 text-right">Pagu (1x)</th>
                        <th className="py-2.5 px-2 text-center">Pemakaian</th>
                        <th className="py-2.5 px-2 text-right">Total Kontrak</th>
                        <th className="py-2.5 px-2 text-right">Sisa Pagu</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSummaries.map((item) => {
                        const { rekening } = item;
                        const inUse = item.jumlahPaket > 0;
                        return (
                          <tr
                            key={rekening.id}
                            data-testid={`rekening-row-${rekening.id}`}
                            className="hover:bg-slate-50/70 align-top"
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-slate-900">
                                {rekening.kodeRekening}
                              </div>
                              <div className="text-slate-700 mt-0.5">{rekening.uraian}</div>
                              {rekening.catatan && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {rekening.catatan}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 tabular-nums">
                              {rekening.tahunAnggaran}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatRupiah(rekening.paguAnggaran)}
                            </td>
                            <td className="py-2.5 px-2 text-center tabular-nums whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md font-semibold ${
                                  inUse
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.jumlahPaket} kegiatan
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                              {formatRupiah(item.totalNilaiKontrak)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  item.isOverBudget ? 'text-rose-700' : 'text-slate-800'
                                }
                              >
                                {item.isOverBudget ? '-' : ''}
                                {formatRupiah(Math.abs(item.sisaPagu))}
                              </span>
                              {item.isOverBudget && (
                                <div className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 font-sans ml-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Melebihi Pagu</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {confirmDeleteId === rekening.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDelete(rekening.id)}
                                    disabled={isDeletingId === rekening.id}
                                    className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                                  >
                                    {isDeletingId === rekening.id ? 'Menghapus...' : 'Ya, Hapus'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(rekening)}
                                    aria-label={`Edit kode rekening ${rekening.kodeRekening}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={inUse}
                                    onClick={() => setConfirmDeleteId(rekening.id)}
                                    aria-label={`Hapus kode rekening ${rekening.kodeRekening}`}
                                    title={
                                      inUse
                                        ? `Tidak dapat dihapus karena masih digunakan oleh ${item.jumlahPaket} kegiatan`
                                        : 'Hapus Kode Rekening'
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 bg-white hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed text-rose-600 font-semibold"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
