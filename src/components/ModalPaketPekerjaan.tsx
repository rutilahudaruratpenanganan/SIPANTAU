import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Check,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  JenisPelaksanaan,
  MekanismePencairan,
  PaketPekerjaan,
  Personel,
  SkemaKontrak,
  StatusPencairan,
  StatusTahapPekerjaan,
  TahapPekerjaan,
} from '../types';
import { PaketPekerjaanMutationPayload } from '../services/firestoreService';
import {
  JENIS_PELAKSANAAN_LIST,
  MAX_DURASI_HARI_KERJA,
  MAX_TAHUN_ANGGARAN,
  MEKANISME_PENCAIRAN_LIST,
  MIN_TAHUN_ANGGARAN,
  SKEMA_KONTRAK_LIST,
  STATUS_PENCAIRAN_LIST,
  addCalendarDaysIso,
  buildTemplateTahapan,
  createTahapId,
  formatRupiah,
  formatTanggalDdMmYyyy,
  formatTanggalDisplay,
  getPaketDurasiHariKerja,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  normalizeTahapanOrder,
  parseRupiahInput,
  resolvePaketTanggalSelesai,
  validatePaketPekerjaanInput,
} from '../utils/pekerjaanLogic';

interface ModalPaketPekerjaanProps {
  isOpen: boolean;
  onClose: () => void;
  initialPaket: PaketPekerjaan | null;
  personelList: Personel[];
  onSave: (payload: PaketPekerjaanMutationPayload, editingId?: string) => Promise<void>;
  onDeletePaket?: (paketId: string) => Promise<void>;
}

export const ModalPaketPekerjaan: React.FC<ModalPaketPekerjaanProps> = ({
  isOpen,
  onClose,
  initialPaket,
  personelList,
  onSave,
  onDeletePaket,
}) => {
  const isEditing = Boolean(initialPaket);

  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [subKegiatan, setSubKegiatan] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');
  const [jenisPelaksanaan, setJenisPelaksanaan] = useState<JenisPelaksanaan>('Perorangan');
  const [skemaKontrak, setSkemaKontrak] = useState<SkemaKontrak | ''>('');
  const [tahunAnggaranText, setTahunAnggaranText] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [nilaiAnggaran, setNilaiAnggaran] = useState<number>(0);
  const [nilaiAnggaranText, setNilaiAnggaranText] = useState<string>('');
  const [hps, setHps] = useState<number | undefined>(undefined);
  const [hpsText, setHpsText] = useState<string>('');
  const [nilaiKontrak, setNilaiKontrak] = useState<number | undefined>(undefined);
  const [nilaiKontrakText, setNilaiKontrakText] = useState<string>('');
  const [tanggalMulai, setTanggalMulai] = useState(getTodayLocalIso());
  const [durasiHariText, setDurasiHariText] = useState('30');
  const [statusPencairan, setStatusPencairan] = useState<StatusPencairan>('Belum');
  const [mekanismePencairan, setMekanismePencairan] = useState<MekanismePencairan | ''>('');
  const [kodeRup, setKodeRup] = useState('');
  const [nomorKontrak, setNomorKontrak] = useState('');
  const [penyedia, setPenyedia] = useState('');
  const [picNama, setPicNama] = useState('');
  const [catatan, setCatatan] = useState('');
  const [tahapan, setTahapan] = useState<TahapPekerjaan[]>(() =>
    buildTemplateTahapan('Perorangan')
  );
  const [hasCustomWorkflowEdit, setHasCustomWorkflowEdit] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialPaket) {
      setNamaKegiatan(initialPaket.namaKegiatan);
      setSubKegiatan(initialPaket.subKegiatan);
      setPekerjaan(initialPaket.pekerjaan || '');
      setJenisPelaksanaan(initialPaket.jenisPelaksanaan);
      setSkemaKontrak(initialPaket.skemaKontrak || '');
      setTahunAnggaranText(String(getPaketTahunAnggaran(initialPaket)));
      setNilaiAnggaran(initialPaket.nilaiAnggaran || 0);
      setNilaiAnggaranText(
        initialPaket.nilaiAnggaran > 0
          ? initialPaket.nilaiAnggaran.toLocaleString('id-ID')
          : '0'
      );
      setHps(initialPaket.hps);
      setHpsText(
        typeof initialPaket.hps === 'number' ? initialPaket.hps.toLocaleString('id-ID') : ''
      );
      setNilaiKontrak(initialPaket.nilaiKontrak);
      setNilaiKontrakText(
        typeof initialPaket.nilaiKontrak === 'number'
          ? initialPaket.nilaiKontrak.toLocaleString('id-ID')
          : ''
      );
      setTanggalMulai(initialPaket.tanggalMulai || getTodayLocalIso());
      setDurasiHariText(String(getPaketDurasiHariKerja(initialPaket)));
      setStatusPencairan(initialPaket.statusPencairan || 'Belum');
      setMekanismePencairan(initialPaket.mekanismePencairan || '');
      setKodeRup(initialPaket.kodeRup || '');
      setNomorKontrak(initialPaket.nomorKontrak || '');
      setPenyedia(initialPaket.penyedia || '');
      setPicNama(initialPaket.picNama || '');
      setCatatan(initialPaket.catatan || '');
      setTahapan(
        initialPaket.tahapan.length > 0
          ? initialPaket.tahapan.map((t, i) => ({ ...t, urutan: i + 1 }))
          : buildTemplateTahapan(initialPaket.jenisPelaksanaan)
      );
      setHasCustomWorkflowEdit(true);
    } else {
      const today = getTodayLocalIso();
      setNamaKegiatan('');
      setSubKegiatan('');
      setPekerjaan('');
      setJenisPelaksanaan('Perorangan');
      setSkemaKontrak('');
      setTahunAnggaranText(today.slice(0, 4));
      setNilaiAnggaran(0);
      setNilaiAnggaranText('');
      setHps(undefined);
      setHpsText('');
      setNilaiKontrak(undefined);
      setNilaiKontrakText('');
      setTanggalMulai(today);
      setDurasiHariText('30');
      setStatusPencairan('Belum');
      setMekanismePencairan('');
      setKodeRup('');
      setNomorKontrak('');
      setPenyedia('');
      setPicNama('');
      setCatatan('');
      setTahapan(buildTemplateTahapan('Perorangan'));
      setHasCustomWorkflowEdit(false);
    }
    setErrorMessage('');
    setIsSaving(false);
    setConfirmDelete(false);
    setIsDeleting(false);
  }, [isOpen, initialPaket]);

  if (!isOpen) return null;

  const handleChangeJenisPelaksanaan = (nextJenis: JenisPelaksanaan) => {
    setJenisPelaksanaan(nextJenis);
    // Automatically load the workflow template when selecting Jenis Pelaksanaan.
    // During editing, preserve existing stages only if the user already customized progress, unless they click reset or haven't edited yet.
    if (!isEditing || !hasCustomWorkflowEdit) {
      setTahapan(buildTemplateTahapan(nextJenis));
      setHasCustomWorkflowEdit(false);
    }
  };

  const handleResetTemplate = () => {
    setTahapan(buildTemplateTahapan(jenisPelaksanaan));
    setHasCustomWorkflowEdit(false);
  };

  const handleAnggaranInputChange = (raw: string) => {
    const parsed = parseRupiahInput(raw);
    setNilaiAnggaran(parsed);
    setNilaiAnggaranText(raw.trim() === '' ? '' : parsed.toLocaleString('id-ID'));
  };

  const handleHpsInputChange = (raw: string) => {
    if (raw.trim() === '') {
      setHps(undefined);
      setHpsText('');
      return;
    }
    const parsed = parseRupiahInput(raw);
    setHps(parsed);
    setHpsText(parsed.toLocaleString('id-ID'));
  };

  const handleNilaiKontrakInputChange = (raw: string) => {
    if (raw.trim() === '') {
      setNilaiKontrak(undefined);
      setNilaiKontrakText('');
      return;
    }
    const parsed = parseRupiahInput(raw);
    setNilaiKontrak(parsed);
    setNilaiKontrakText(parsed.toLocaleString('id-ID'));
  };

  const handleStageNameChange = (id: string, nextName: string) => {
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => prev.map((t) => (t.id === id ? { ...t, nama: nextName } : t)));
  };

  const handleStageStatusChange = (id: string, nextStatus: StatusTahapPekerjaan) => {
    setHasCustomWorkflowEdit(true);
    const today = getTodayLocalIso();
    setTahapan((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status: nextStatus,
          tanggalSelesai: nextStatus === 'selesai' ? t.tanggalSelesai || today : undefined,
        };
      })
    );
  };

  const handleStageTargetChange = (id: string, nextTarget: string) => {
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) =>
      prev.map((t) => (t.id === id ? { ...t, tanggalTarget: nextTarget || undefined } : t))
    );
  };

  const handleMoveStage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= tahapan.length) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return normalizeTahapanOrder(next);
    });
  };

  const handleDeleteStage = (id: string) => {
    if (tahapan.length <= 1) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) => normalizeTahapanOrder(prev.filter((t) => t.id !== id)));
  };

  const handleAddStage = () => {
    if (tahapan.length >= 30) return;
    setHasCustomWorkflowEdit(true);
    setTahapan((prev) =>
      normalizeTahapanOrder([
        ...prev,
        {
          id: createTahapId(prev.length + 1),
          urutan: prev.length + 1,
          nama: `Tahapan Tambahan ${prev.length + 1}`,
          status: 'belum_mulai',
        },
      ])
    );
  };

  const trimmedTahun = tahunAnggaranText.trim();
  const parsedTahunNumber = trimmedTahun === '' ? NaN : Number(trimmedTahun);
  const tahunAnggaran =
    Number.isInteger(parsedTahunNumber) ? parsedTahunNumber : NaN;

  const trimmedDurasi = durasiHariText.trim();
  const parsedDurasiNumber = trimmedDurasi === '' ? NaN : Number(trimmedDurasi);
  const durasiHariKerja =
    Number.isInteger(parsedDurasiNumber) && parsedDurasiNumber >= 1
      ? parsedDurasiNumber
      : NaN;
  const computedTanggalSelesai = Number.isInteger(durasiHariKerja)
    ? addCalendarDaysIso(tanggalMulai, durasiHariKerja)
    : '';

  const currentYear = new Date().getFullYear();
  const presetYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const handleDeleteCurrent = async () => {
    if (!initialPaket || !onDeletePaket) return;
    setErrorMessage('');
    setIsDeleting(true);
    try {
      await onDeletePaket(initialPaket.id);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menghapus paket pekerjaan.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTahapan = normalizeTahapanOrder(tahapan);
    const resolvedTanggalSelesai = resolvePaketTanggalSelesai(
      cleanedTahapan,
      initialPaket?.tanggalSelesai,
      getTodayLocalIso()
    );
    const validationErr = validatePaketPekerjaanInput({
      namaKegiatan,
      subKegiatan,
      jenisPelaksanaan,
      skemaKontrak: skemaKontrak || undefined,
      tahunAnggaran,
      nilaiAnggaran,
      hps,
      nilaiKontrak,
      tanggalMulai,
      durasiHariKerja,
      tenggatWaktu: computedTanggalSelesai,
      tanggalSelesai: resolvedTanggalSelesai,
      statusPencairan,
      mekanismePencairan: mekanismePencairan || undefined,
      tahapan: cleanedTahapan,
    });

    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setErrorMessage('');
    setIsSaving(true);
    try {
      await onSave(
        {
          namaKegiatan: namaKegiatan.trim(),
          subKegiatan: subKegiatan.trim(),
          pekerjaan: pekerjaan.trim() || undefined,
          jenisPelaksanaan,
          skemaKontrak: skemaKontrak || undefined,
          tahunAnggaran,
          nilaiAnggaran,
          hps,
          nilaiKontrak,
          tanggalMulai: tanggalMulai.trim(),
          durasiHariKerja,
          tenggatWaktu: computedTanggalSelesai,
          tanggalSelesai: resolvedTanggalSelesai,
          statusPencairan,
          mekanismePencairan: mekanismePencairan || undefined,
          kodeRup: kodeRup.trim() || undefined,
          nomorKontrak: nomorKontrak.trim() || undefined,
          penyedia: penyedia.trim() || undefined,
          picNama: picNama.trim() || undefined,
          catatan: catatan.trim() || undefined,
          tahapan: cleanedTahapan,
        },
        initialPaket?.id
      );
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan paket pekerjaan ke database.'
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
      aria-labelledby="modal-paket-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <BriefcaseBusiness className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-paket-title" className="text-sm sm:text-base font-bold truncate">
                {isEditing ? 'Edit Keseluruhan Paket Pekerjaan' : 'Tambah Paket Pekerjaan Baru'}
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Atur identitas kegiatan, anggaran, jadwal pelaksanaan, dan tahapan kerja
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form paket pekerjaan"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Identitas Paket Pekerjaan */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
              1. Informasi Paket Pekerjaan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="paket-nama-kegiatan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nama Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-nama-kegiatan"
                  type="text"
                  required
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  placeholder="Contoh: Pengawasan & Pengendalian Perumahan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-sub-kegiatan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Sub Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-sub-kegiatan"
                  type="text"
                  required
                  value={subKegiatan}
                  onChange={(e) => setSubKegiatan(e.target.value)}
                  placeholder="Contoh: Kajian Teknis Kelaikan Bangunan"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="paket-pekerjaan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pekerjaan
                </label>
                <input
                  id="paket-pekerjaan"
                  type="text"
                  maxLength={300}
                  value={pekerjaan}
                  onChange={(e) => setPekerjaan(e.target.value)}
                  placeholder="Contoh: Pengawasan Teknis Pembangunan Perumahan Wilayah Timur"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="paket-jenis-pelaksanaan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Jenis Pelaksanaan <span className="text-rose-600">*</span>
                </label>
                <select
                  id="paket-jenis-pelaksanaan"
                  value={jenisPelaksanaan}
                  onChange={(e) =>
                    handleChangeJenisPelaksanaan(e.target.value as JenisPelaksanaan)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  {JENIS_PELAKSANAAN_LIST.map((jenis) => (
                    <option key={jenis} value={jenis}>
                      {jenis}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Otomatis memuat template tahapan.
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-skema-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Skema Kontrak
                </label>
                <select
                  id="paket-skema-kontrak"
                  value={skemaKontrak}
                  onChange={(e) => setSkemaKontrak(e.target.value as SkemaKontrak | '')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  <option value="">-- Pilih Skema Kontrak --</option>
                  {SKEMA_KONTRAK_LIST.map((skema) => (
                    <option key={skema} value={skema}>
                      {skema}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lump Sum atau Waktu Penugasan.
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-mekanisme-pencairan"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Mekanisme Pencairan
                </label>
                <select
                  id="paket-mekanisme-pencairan"
                  value={mekanismePencairan}
                  onChange={(e) =>
                    setMekanismePencairan(e.target.value as MekanismePencairan | '')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 font-medium"
                >
                  <option value="">-- Pilih Mekanisme --</option>
                  {MEKANISME_PENCAIRAN_LIST.map((mek) => (
                    <option key={mek} value={mek}>
                      {mek}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  LS, GU, atau TU.
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-tahun-anggaran"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tahun Anggaran <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold text-[11px]">
                    TA
                  </span>
                  <input
                    id="paket-tahun-anggaran"
                    type="number"
                    min={MIN_TAHUN_ANGGARAN}
                    max={MAX_TAHUN_ANGGARAN}
                    step={1}
                    list="tahun-anggaran-presets"
                    required
                    value={tahunAnggaranText}
                    onChange={(e) => setTahunAnggaranText(e.target.value)}
                    placeholder={String(currentYear)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                  <datalist id="tahun-anggaran-presets">
                    {presetYears.map((yr) => (
                      <option key={yr} value={yr} />
                    ))}
                  </datalist>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Dasar pengelompokan rekap tahunan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="paket-nilai-anggaran"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Pagu Anggaran (Rp) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-nilai-anggaran"
                    type="text"
                    inputMode="numeric"
                    required
                    value={nilaiAnggaranText}
                    onChange={(e) => handleAnggaranInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  Terbaca: {formatRupiah(nilaiAnggaran)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-hps"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Harga Perkiraan Sendiri (HPS) (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-hps"
                    type="text"
                    inputMode="numeric"
                    value={hpsText}
                    onChange={(e) => handleHpsInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {hps !== undefined ? `Terbaca: ${formatRupiah(hps)}` : 'Opsional (Rp)'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-nilai-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nilai Kontrak / Realisasi (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-semibold">
                    Rp
                  </span>
                  <input
                    id="paket-nilai-kontrak"
                    type="text"
                    inputMode="numeric"
                    value={nilaiKontrakText}
                    onChange={(e) => handleNilaiKontrakInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {nilaiKontrak !== undefined
                    ? `Terbaca: ${formatRupiah(nilaiKontrak)}`
                    : 'Opsional (Rp)'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="paket-tanggal-mulai"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tanggal Mulai <span className="text-rose-600">*</span>
                </label>
                <input
                  id="paket-tanggal-mulai"
                  type="date"
                  required
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {tanggalMulai
                    ? `${formatTanggalDisplay(tanggalMulai)} (${formatTanggalDdMmYyyy(tanggalMulai)})`
                    : 'Format DD-MM-YYYY'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-durasi-hari"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Durasi (Hari Kalender) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="paket-durasi-hari"
                    type="number"
                    min={1}
                    max={MAX_DURASI_HARI_KERJA}
                    step={1}
                    required
                    value={durasiHariText}
                    onChange={(e) => setDurasiHariText(e.target.value)}
                    placeholder="30"
                    className="w-full pl-3 pr-24 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-500 pointer-events-none">
                    hari kalender
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tanggal Mulai dihitung sebagai hari ke-1 (Senin–Minggu)
                </p>
              </div>

              <div>
                <label
                  htmlFor="paket-tanggal-selesai"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Tanggal Selesai <span className="text-slate-400 font-normal">(Otomatis)</span>
                </label>
                <input
                  id="paket-tanggal-selesai"
                  type="text"
                  readOnly
                  aria-readonly="true"
                  value={computedTanggalSelesai ? formatTanggalDisplay(computedTanggalSelesai) : '-'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-semibold tabular-nums text-slate-800 cursor-not-allowed focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {computedTanggalSelesai
                    ? `DD-MM-YYYY: ${formatTanggalDdMmYyyy(computedTanggalSelesai)}`
                    : 'Otomatis: Tanggal Mulai (hari ke-1) + Durasi'}
                </p>
              </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="paket-kode-rup"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Kode RUP
                </label>
                <input
                  id="paket-kode-rup"
                  type="text"
                  maxLength={100}
                  value={kodeRup}
                  onChange={(e) => setKodeRup(e.target.value)}
                  placeholder="Contoh: 51234567"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-nomor-kontrak"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Nomor Kontrak / SPK
                </label>
                <input
                  id="paket-nomor-kontrak"
                  type="text"
                  value={nomorKontrak}
                  onChange={(e) => setNomorKontrak(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-penyedia"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Penyedia / Pelaksana
                </label>
                <input
                  id="paket-penyedia"
                  type="text"
                  value={penyedia}
                  onChange={(e) => setPenyedia(e.target.value)}
                  placeholder="Nama konsultan / badan usaha / tim"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="paket-pic"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Penanggung Jawab (PIC)
                </label>
                <select
                  id="paket-pic"
                  value={picNama}
                  onChange={(e) => setPicNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                >
                  <option value="">-- Pilih Personel PIC --</option>
                  {personelList.map((p) => (
                    <option key={p.id} value={p.nama}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Template Tahapan Otomatis & Custom Workflow */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  2. Alur Tahapan Pekerjaan ({tahapan.length} Tahap)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Otomatis terisi sesuai jenis pelaksanaan{' '}
                  <span className="font-semibold text-slate-700">{jenisPelaksanaan}</span> · Tetap
                  dapat diubah, ditambah, diurutkan, atau dihapus secara manual.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Muat Template {jenisPelaksanaan}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddStage}
                  disabled={tahapan.length >= 30}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tahapan</span>
                </button>
              </div>
            </div>

            {/* Tahapan Pencairan dalam Alur Tahapan Pekerjaan */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="paket-status-pencairan"
                  className="block font-semibold text-slate-800"
                >
                  Tahapan Pencairan
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Status pencairan anggaran sebagai bagian dari alur tahapan pekerjaan.
                </p>
              </div>
              <div className="w-full sm:w-48 shrink-0">
                <select
                  id="paket-status-pencairan"
                  value={statusPencairan}
                  onChange={(e) => setStatusPencairan(e.target.value as StatusPencairan)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 font-medium"
                >
                  {STATUS_PENCAIRAN_LIST.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2" data-testid="workflow-stages-editor">
              {tahapan.map((stage, idx) => (
                <div
                  key={stage.id}
                  data-testid={`workflow-stage-row-${idx}`}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nama Tahap ${idx + 1}`}
                      value={stage.nama}
                      onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                      placeholder={`Nama tahap ke-${idx + 1}`}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Status Tahap ${idx + 1}`}
                      value={stage.status}
                      onChange={(e) =>
                        handleStageStatusChange(stage.id, e.target.value as StatusTahapPekerjaan)
                      }
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="belum_mulai">Belum Mulai</option>
                      <option value="sedang_berjalan">Sedang Berjalan</option>
                      <option value="selesai">Selesai</option>
                    </select>

                    <input
                      type="date"
                      aria-label={`Target Tanggal Tahap ${idx + 1}`}
                      title="Target tanggal tahap (opsional)"
                      value={stage.tanggalTarget || ''}
                      onChange={(e) => handleStageTargetChange(stage.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-mono tabular-nums text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Naikkan urutan tahap ${idx + 1}`}
                        title="Naikkan urutan"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, 1)}
                        disabled={idx === tahapan.length - 1}
                        aria-label={`Turunkan urutan tahap ${idx + 1}`}
                        title="Turunkan urutan"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage.id)}
                        disabled={tahapan.length <= 1}
                        aria-label={`Hapus tahap ${idx + 1}`}
                        title="Hapus tahapan"
                        className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 disabled:opacity-40 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label htmlFor="paket-catatan" className="block font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Tambahan
            </label>
            <textarea
              id="paket-catatan"
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan kendala, lokasi pekerjaan, atau informasi tambahan (opsional)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
            <div>
              {isEditing && initialPaket && onDeletePaket && (
                confirmDelete ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDeleteCurrent}
                      disabled={isDeleting || isSaving}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold transition-colors"
                    >
                      {isDeleting ? 'Menghapus...' : 'Ya, Hapus Paket'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isDeleting}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Paket</span>
                  </button>
                )
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Menyimpan...'
                    : isEditing
                    ? 'Simpan Perubahan Paket'
                    : 'Simpan Paket Pekerjaan'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
