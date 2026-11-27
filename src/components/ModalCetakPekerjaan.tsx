import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  JenisPelaksanaan,
  MekanismePencairan,
  PaketPekerjaan,
  PejabatConfig,
  RekeningAnggaran,
  SkemaKontrak,
  SkemaPembayaran,
  StatusPencairan,
} from '../types';
import {
  JENIS_PELAKSANAAN_LIST,
  MEKANISME_PENCAIRAN_LIST,
  PaketOverallStatus,
  SKEMA_KONTRAK_LIST,
  SKEMA_PEMBAYARAN_LIST,
  STATUS_PENCAIRAN_LIST,
  buildPekerjaanCsvContent,
  calculatePekerjaanStats,
  computePaketProgress,
  filterPaketPekerjaan,
  formatRupiah,
  formatTanggalDdMmYyyy,
  formatTanggalDisplay,
  getAvailableKodeRekeningOptions,
  getAvailablePicNames,
  getAvailableTahunAnggaran,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  resolvePaketPaguInfo,
  resolveTerminNominal,
  summarizeMakananMinuman,
  summarizePaketByJenis,
  summarizePaketByTahunAnggaran,
  summarizeRekeningAnggaran,
  summarizeTerminPencairan,
} from '../utils/pekerjaanLogic';

export type PrintPekerjaanMode = 'rekap' | 'kartu';

export interface ModalCetakPekerjaanInitialState {
  mode?: PrintPekerjaanMode;
  selectedPaketId?: string | 'all';
  kodeRekening?: string | 'all';
  tahunAnggaran?: number | 'all';
  jenisPelaksanaan?: JenisPelaksanaan | 'all';
  skemaKontrak?: SkemaKontrak | 'all';
  skemaPembayaran?: SkemaPembayaran | 'all';
  statusPencairan?: StatusPencairan | 'all';
  mekanismePencairan?: MekanismePencairan | 'all';
  status?: PaketOverallStatus | 'all';
  picNama?: string | 'all';
  searchQuery?: string;
}

interface ModalCetakPekerjaanProps {
  isOpen: boolean;
  onClose: () => void;
  paketList: PaketPekerjaan[];
  rekeningList?: RekeningAnggaran[];
  pejabatConfig: PejabatConfig;
  initialState?: ModalCetakPekerjaanInitialState;
  onNotify?: (msg: string) => void;
}

export const ModalCetakPekerjaan: React.FC<ModalCetakPekerjaanProps> = ({
  isOpen,
  onClose,
  paketList,
  rekeningList = [],
  pejabatConfig,
  initialState,
  onNotify,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);

  const [printMode, setPrintMode] = useState<PrintPekerjaanMode>('rekap');
  const [selectedPaketId, setSelectedPaketId] = useState<string | 'all'>('all');
  const [kodeRekening, setKodeRekening] = useState<string | 'all'>('all');
  const [tahunAnggaran, setTahunAnggaran] = useState<number | 'all'>('all');
  const [jenisPelaksanaan, setJenisPelaksanaan] = useState<JenisPelaksanaan | 'all'>('all');
  const [skemaKontrak, setSkemaKontrak] = useState<SkemaKontrak | 'all'>('all');
  const [skemaPembayaran, setSkemaPembayaran] = useState<SkemaPembayaran | 'all'>('all');
  const [statusPencairan, setStatusPencairan] = useState<StatusPencairan | 'all'>('all');
  const [mekanismePencairan, setMekanismePencairan] = useState<MekanismePencairan | 'all'>('all');
  const [statusPaket, setStatusPaket] = useState<PaketOverallStatus | 'all'>('all');
  const [picNama, setPicNama] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeRingkasan, setIncludeRingkasan] = useState(true);
  const [includeTahapan, setIncludeTahapan] = useState(true);
  const [includeTtd, setIncludeTtd] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setPrintMode(initialState?.mode || (initialState?.selectedPaketId ? 'kartu' : 'rekap'));
    setSelectedPaketId(initialState?.selectedPaketId || 'all');
    setKodeRekening(initialState?.kodeRekening ?? 'all');
    setTahunAnggaran(initialState?.tahunAnggaran ?? 'all');
    setJenisPelaksanaan(initialState?.jenisPelaksanaan ?? 'all');
    setSkemaKontrak(initialState?.skemaKontrak ?? 'all');
    setSkemaPembayaran(initialState?.skemaPembayaran ?? 'all');
    setStatusPencairan(initialState?.statusPencairan ?? 'all');
    setMekanismePencairan(initialState?.mekanismePencairan ?? 'all');
    setStatusPaket(initialState?.status ?? 'all');
    setPicNama(initialState?.picNama ?? 'all');
    setSearchQuery(initialState?.searchQuery ?? '');
  }, [isOpen, initialState]);

  const availableYears = useMemo(
    () => getAvailableTahunAnggaran(paketList, rekeningList),
    [paketList, rekeningList]
  );
  const availablePics = useMemo(() => getAvailablePicNames(paketList), [paketList]);
  const rekeningFilterOptions = useMemo(
    () => getAvailableKodeRekeningOptions(paketList, rekeningList, tahunAnggaran),
    [paketList, rekeningList, tahunAnggaran]
  );

  const filteredList = useMemo(
    () =>
      filterPaketPekerjaan(
        paketList,
        {
          kodeRekening,
          tahunAnggaran,
          jenisPelaksanaan,
          skemaKontrak,
          skemaPembayaran,
          statusPencairan,
          mekanismePencairan,
          status: statusPaket,
          picNama,
          searchQuery,
        },
        todayIso,
        rekeningList
      ),
    [
      paketList,
      rekeningList,
      kodeRekening,
      tahunAnggaran,
      jenisPelaksanaan,
      skemaKontrak,
      skemaPembayaran,
      statusPencairan,
      mekanismePencairan,
      statusPaket,
      picNama,
      searchQuery,
      todayIso,
    ]
  );

  const printableKartuList = useMemo(() => {
    if (selectedPaketId !== 'all') {
      const exact = paketList.find((p) => p.id === selectedPaketId);
      return exact ? [exact] : filteredList;
    }
    return filteredList;
  }, [paketList, filteredList, selectedPaketId]);

  const activeItems = printMode === 'kartu' ? printableKartuList : filteredList;
  const stats = useMemo(
    () => calculatePekerjaanStats(activeItems, todayIso, rekeningList),
    [activeItems, todayIso, rekeningList]
  );
  const tahunSummaries = useMemo(
    () => summarizePaketByTahunAnggaran(paketList, todayIso, rekeningList),
    [paketList, todayIso, rekeningList]
  );
  const jenisSummaries = useMemo(
    () => summarizePaketByJenis(filteredList, todayIso, rekeningList),
    [filteredList, todayIso, rekeningList]
  );
  const rekeningPrintSummaries = useMemo(
    () =>
      summarizeRekeningAnggaran(rekeningList, activeItems, todayIso).filter(
        (s) =>
          s.jumlahPaket > 0 &&
          (tahunAnggaran === 'all' || s.rekening.tahunAnggaran === tahunAnggaran)
      ),
    [rekeningList, activeItems, todayIso, tahunAnggaran]
  );
  const sharedCountByDedupeKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of activeItems) {
      const info = resolvePaketPaguInfo(p, rekeningList);
      counts.set(info.dedupeKey, (counts.get(info.dedupeKey) || 0) + 1);
    }
    return counts;
  }, [activeItems, rekeningList]);

  if (!isOpen) return null;

  const hasActiveFilters =
    kodeRekening !== 'all' ||
    tahunAnggaran !== 'all' ||
    jenisPelaksanaan !== 'all' ||
    skemaKontrak !== 'all' ||
    skemaPembayaran !== 'all' ||
    statusPencairan !== 'all' ||
    mekanismePencairan !== 'all' ||
    statusPaket !== 'all' ||
    picNama !== 'all' ||
    searchQuery.trim() !== '' ||
    selectedPaketId !== 'all';

  const handleResetFilters = () => {
    setSelectedPaketId('all');
    setKodeRekening('all');
    setTahunAnggaran('all');
    setJenisPelaksanaan('all');
    setSkemaKontrak('all');
    setSkemaPembayaran('all');
    setStatusPencairan('all');
    setMekanismePencairan('all');
    setStatusPaket('all');
    setPicNama('all');
    setSearchQuery('');
  };

  const applyPreset = (
    preset:
      | 'all'
      | 'sudah_cair'
      | 'belum_cair'
      | 'termin'
      | 'sekaligus'
      | 'lump_sum'
      | 'waktu_penugasan'
      | 'pengadaan_langsung'
      | 'katalog'
      | 'terlambat'
      | 'selesai'
  ) => {
    setSelectedPaketId('all');
    if (preset === 'all') {
      setKodeRekening('all');
    }
    setJenisPelaksanaan('all');
    setMekanismePencairan('all');
    setPicNama('all');
    setSearchQuery('');
    setSkemaKontrak('all');
    setSkemaPembayaran('all');
    setStatusPencairan('all');
    setStatusPaket('all');

    if (preset === 'sudah_cair') {
      setStatusPencairan('Sudah');
    } else if (preset === 'belum_cair') {
      setStatusPencairan('Belum');
    } else if (preset === 'termin') {
      setSkemaPembayaran('Termin');
    } else if (preset === 'sekaligus') {
      setSkemaPembayaran('Sekaligus');
    } else if (preset === 'lump_sum') {
      setSkemaKontrak('Lump Sum');
    } else if (preset === 'waktu_penugasan') {
      setSkemaKontrak('Waktu Penugasan');
    } else if (preset === 'pengadaan_langsung') {
      setSkemaKontrak('Pengadaan Langsung');
    } else if (preset === 'katalog') {
      setSkemaKontrak('Katalog');
    } else if (preset === 'terlambat') {
      setStatusPaket('terlambat');
    } else if (preset === 'selesai') {
      setStatusPaket('selesai');
    }
  };

  const activeFilterLabels: string[] = [];
  if (kodeRekening !== 'all') {
    const matchedOpt = rekeningFilterOptions.find((o) => o.key === kodeRekening);
    activeFilterLabels.push(
      `Kode Rekening: ${matchedOpt?.kodeRekening || kodeRekening}`
    );
  }
  if (tahunAnggaran !== 'all') activeFilterLabels.push(`TA ${tahunAnggaran}`);
  if (jenisPelaksanaan !== 'all') activeFilterLabels.push(`Pelaksanaan: ${jenisPelaksanaan}`);
  if (skemaKontrak !== 'all') activeFilterLabels.push(`Skema Kontrak: ${skemaKontrak}`);
  if (skemaPembayaran !== 'all') activeFilterLabels.push(`Pembayaran: ${skemaPembayaran}`);
  if (statusPencairan !== 'all') activeFilterLabels.push(`Pencairan: ${statusPencairan}`);
  if (mekanismePencairan !== 'all') activeFilterLabels.push(`Mekanisme: ${mekanismePencairan}`);
  if (statusPaket !== 'all') {
    const map: Record<PaketOverallStatus, string> = {
      belum_mulai: 'Belum Mulai',
      sedang_berjalan: 'Sedang Berjalan',
      terlambat: 'Terlambat',
      selesai: 'Selesai',
    };
    activeFilterLabels.push(`Progres: ${map[statusPaket]}`);
  }
  if (picNama !== 'all') activeFilterLabels.push(`PIC: ${picNama}`);
  if (searchQuery.trim()) activeFilterLabels.push(`Kata Kunci: "${searchQuery.trim()}"`);

  const printedDateText = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const csv = buildPekerjaanCsvContent(activeItems, todayIso, rekeningList);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cetak_Pekerjaan_${todayIso}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify?.(`Data cetak pekerjaan (${activeItems.length} paket) berhasil diekspor ke CSV.`);
  };

  const stageStatusLabel = (st: 'belum_mulai' | 'sedang_berjalan' | 'selesai') => {
    if (st === 'selesai') return 'Selesai';
    if (st === 'sedang_berjalan') return 'Sedang Berjalan';
    return 'Belum Mulai';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:static print:inset-auto print:p-0 print:bg-white print:block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cetak-pekerjaan-title"
    >
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-4 max-h-[94vh] flex flex-col print:shadow-none print:border-none print:max-h-none print:my-0 print:w-full print:rounded-none">
        {/* Top Action Bar (hidden on print) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-cetak-pekerjaan-title" className="text-sm font-bold truncate">
                Menu Cetak Pekerjaan &amp; Kartu Kendali
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Pratinjau cetak resmi ber-KOP dengan filter khusus, rincian anggaran, dan progres tahapan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Mode Switcher */}
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setPrintMode('rekap')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  printMode === 'rekap'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Laporan Rekap</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('kartu')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  printMode === 'kartu'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Kartu Kendali</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={activeItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV ({activeItems.length})</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={activeItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF ({activeItems.length})</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup menu cetak pekerjaan"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Print Options Panel (hidden on print) */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 text-xs shrink-0 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* TA Quick Selector Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 mr-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Tahun Anggaran:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPaketId('all');
                  setTahunAnggaran('all');
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                  tahunAnggaran === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Semua TA ({paketList.length})
              </button>
              {availableYears.map((yr) => {
                const count = paketList.filter((p) => getPaketTahunAnggaran(p) === yr).length;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setSelectedPaketId('all');
                      setTahunAnggaran(yr);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors tabular-nums ${
                      tahunAnggaran === yr
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    TA {yr} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              {printMode === 'rekap' && (
                <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeRingkasan}
                    onChange={(e) => setIncludeRingkasan(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Ringkasan TA &amp; Jenis</span>
                </label>
              )}
              <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTahapan}
                  onChange={(e) => setIncludeTahapan(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Rincian Tahapan</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTtd}
                  onChange={(e) => setIncludeTtd(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Blok Pengesahan (TTD)</span>
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Preset Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600 mr-1">Filter Cepat:</span>
            {(
              [
                { id: 'all', label: 'Semua Paket' },
                { id: 'sudah_cair', label: 'Sudah Cair' },
                { id: 'belum_cair', label: 'Belum Cair' },
                { id: 'termin', label: 'Pembayaran Termin' },
                { id: 'sekaligus', label: 'Sekaligus' },
                { id: 'lump_sum', label: 'Lump Sum' },
                { id: 'waktu_penugasan', label: 'Waktu Penugasan' },
                { id: 'pengadaan_langsung', label: 'Pengadaan Langsung' },
                { id: 'katalog', label: 'Katalog' },
                { id: 'terlambat', label: 'Terlambat' },
                { id: 'selesai', label: 'Tuntas 100%' },
              ] as const
            ).map((p) => {
              const active =
                (p.id === 'all' &&
                  skemaKontrak === 'all' &&
                  skemaPembayaran === 'all' &&
                  statusPencairan === 'all' &&
                  statusPaket === 'all' &&
                  selectedPaketId === 'all') ||
                (p.id === 'sudah_cair' && statusPencairan === 'Sudah') ||
                (p.id === 'belum_cair' && statusPencairan === 'Belum') ||
                (p.id === 'termin' && skemaPembayaran === 'Termin') ||
                (p.id === 'sekaligus' && skemaPembayaran === 'Sekaligus') ||
                (p.id === 'lump_sum' && skemaKontrak === 'Lump Sum') ||
                (p.id === 'waktu_penugasan' && skemaKontrak === 'Waktu Penugasan') ||
                (p.id === 'pengadaan_langsung' && skemaKontrak === 'Pengadaan Langsung') ||
                (p.id === 'katalog' && skemaKontrak === 'Katalog') ||
                (p.id === 'terlambat' && statusPaket === 'terlambat') ||
                (p.id === 'selesai' && statusPaket === 'selesai');
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {rekeningFilterOptions.length > 0 && (
              <select
                aria-label="Filter cetak kode rekening"
                value={kodeRekening}
                onChange={(e) => {
                  setSelectedPaketId('all');
                  setKodeRekening(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
              >
                <option value="all">Semua Kode Rekening</option>
                {rekeningFilterOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.kodeRekening}
                    {opt.uraian ? ` — ${opt.uraian}` : ''}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter cetak tahun anggaran"
              value={tahunAnggaran === 'all' ? 'all' : String(tahunAnggaran)}
              onChange={(e) => {
                setSelectedPaketId('all');
                setTahunAnggaran(e.target.value === 'all' ? 'all' : Number(e.target.value));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800 tabular-nums"
            >
              <option value="all">Semua TA</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  TA {yr}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak jenis pelaksanaan"
              value={jenisPelaksanaan}
              onChange={(e) => {
                setSelectedPaketId('all');
                setJenisPelaksanaan(e.target.value as JenisPelaksanaan | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Pelaksanaan</option>
              {JENIS_PELAKSANAAN_LIST.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak skema kontrak"
              value={skemaKontrak}
              onChange={(e) => {
                setSelectedPaketId('all');
                setSkemaKontrak(e.target.value as SkemaKontrak | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Skema</option>
              {SKEMA_KONTRAK_LIST.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak skema pembayaran"
              value={skemaPembayaran}
              onChange={(e) => {
                setSelectedPaketId('all');
                setSkemaPembayaran(e.target.value as SkemaPembayaran | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Pembayaran</option>
              {SKEMA_PEMBAYARAN_LIST.map((sp) => (
                <option key={sp} value={sp}>
                  {sp === 'Termin' ? 'Pembayaran Termin' : 'Sekaligus'}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak tahapan pencairan"
              value={statusPencairan}
              onChange={(e) => {
                setSelectedPaketId('all');
                setStatusPencairan(e.target.value as StatusPencairan | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Pencairan</option>
              {STATUS_PENCAIRAN_LIST.map((st) => (
                <option key={st} value={st}>
                  Pencairan: {st}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak mekanisme pencairan"
              value={mekanismePencairan}
              onChange={(e) => {
                setSelectedPaketId('all');
                setMekanismePencairan(e.target.value as MekanismePencairan | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Mekanisme</option>
              {MEKANISME_PENCAIRAN_LIST.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter cetak status progres"
              value={statusPaket}
              onChange={(e) => {
                setSelectedPaketId('all');
                setStatusPaket(e.target.value as PaketOverallStatus | 'all');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua Status</option>
              <option value="belum_mulai">Belum Mulai</option>
              <option value="sedang_berjalan">Sedang Berjalan</option>
              <option value="terlambat">Terlambat</option>
              <option value="selesai">Selesai</option>
            </select>

            <select
              aria-label="Filter cetak PIC"
              value={picNama}
              onChange={(e) => {
                setSelectedPaketId('all');
                setPicNama(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800"
            >
              <option value="all">Semua PIC</option>
              {availablePics.map((pic) => (
                <option key={pic} value={pic}>
                  {pic}
                </option>
              ))}
            </select>

            {printMode === 'kartu' ? (
              <select
                aria-label="Pilih paket kartu kendali"
                value={selectedPaketId}
                onChange={(e) => setSelectedPaketId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-[11px] font-semibold text-blue-950"
              >
                <option value="all">Semua Paket Terfilter ({filteredList.length})</option>
                {paketList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.subKegiatan}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                aria-label="Cari kata kunci cetak pekerjaan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kata kunci RUP / paket..."
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] text-slate-800"
              />
            )}
          </div>
        </div>

        {/* Printable Official Sheet Preview */}
        <div className="p-5 sm:p-8 print:p-4 overflow-y-auto flex-1 bg-white text-slate-900 text-xs space-y-5">
          {activeItems.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada paket pekerjaan yang sesuai dengan filter cetak saat ini.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Tampilkan Semua Paket
              </button>
            </div>
          ) : printMode === 'rekap' ? (
            <div className="space-y-5">
              {/* Official Header (KOP) */}
              <div className="text-center border-b-4 border-double border-slate-900 pb-4 font-serif">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-700">
                  Pemerintah Kota Bandung
                </div>
                <div className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
                  {pejabatConfig.kepalaDinas.instansi}
                </div>
                <div className="text-xs font-bold uppercase text-slate-800">
                  Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
                </div>
                <div className="text-[10px] text-slate-600 font-sans mt-1">
                  Jalan Caringin Nomor 103 Telp. (022) 5410403 · Email: dpkpkotabandung@gmail.com
                </div>
              </div>

              {/* Document Title & Active Filters */}
              <div className="text-center space-y-1">
                <h3 className="text-sm font-extrabold uppercase tracking-wide underline">
                  LAPORAN PEMANTAUAN KEGIATAN &amp; PEKERJAAN
                </h3>
                <p className="text-[11px] text-slate-600">
                  Kriteria:{' '}
                  <span className="font-semibold text-slate-800">
                    {activeFilterLabels.length > 0
                      ? activeFilterLabels.join(' · ')
                      : 'Semua Tahun Anggaran & Seluruh Kategori'}
                  </span>{' '}
                  · Dicetak pada: {printedDateText}
                </p>
              </div>

              {/* Ringkasan Lintas Tahun Anggaran & Jenis Pelaksanaan (gabungan dari Rekap Pekerjaan) */}
              {includeRingkasan && (
                <div className="space-y-4">
                  {tahunAnggaran === 'all' && tahunSummaries.length > 0 && (
                    <div className="space-y-1.5 print:break-inside-avoid">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                          Ringkasan Per Tahun Anggaran
                        </h4>
                        <span className="text-[10px] text-slate-500 print:hidden">
                          Klik tahun untuk memfokuskan laporan
                        </span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                              <th className="border-r border-slate-800 py-1.5 px-2.5">
                                Tahun Anggaran
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Paket
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Tuntas
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Pagu Anggaran
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Nilai Kontrak
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Serapan (%)
                              </th>
                              <th className="py-1.5 px-2.5 text-right">Rata-Rata Progres</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300">
                            {tahunSummaries.map((row) => (
                              <tr key={row.tahunAnggaran} className="hover:bg-blue-50/50">
                                <td className="border-r border-slate-800 py-1.5 px-2.5 font-mono font-bold tabular-nums">
                                  <button
                                    type="button"
                                    onClick={() => setTahunAnggaran(row.tahunAnggaran)}
                                    className="text-blue-700 hover:underline font-mono font-bold print:no-underline print:text-slate-900"
                                  >
                                    TA {row.tahunAnggaran}
                                  </button>
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono tabular-nums">
                                  {row.totalPaket}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono font-semibold text-emerald-800 tabular-nums">
                                  {row.selesai}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono font-semibold tabular-nums">
                                  {formatRupiah(row.totalAnggaran)}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono text-emerald-800 tabular-nums">
                                  {formatRupiah(row.totalNilaiKontrak)}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono font-semibold tabular-nums">
                                  {row.persentaseRealisasiAnggaran}%
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-blue-800 tabular-nums">
                                  {row.rataRataProgres}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {rekeningPrintSummaries.length > 0 && (
                    <div className="space-y-1.5 print:break-inside-avoid">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                          Ringkasan Pagu Per Kode Rekening (1 Rekening = 1 Pagu Anggaran)
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          Pagu dihitung 1x per kode rekening meskipun dipakai beberapa kegiatan
                        </span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                              <th className="border-r border-slate-800 py-1.5 px-2.5">
                                Kode Rekening &amp; Uraian
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2 text-center">
                                TA
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2 text-right">
                                Kegiatan
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Pagu (1x)
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Total Kontrak
                              </th>
                              <th className="border-r border-slate-800 py-1.5 px-2.5 text-right">
                                Sisa Pagu
                              </th>
                              <th className="py-1.5 px-2 text-right">Serapan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300">
                            {rekeningPrintSummaries.map((row) => (
                              <tr key={row.rekening.id}>
                                <td className="border-r border-slate-800 py-1.5 px-2.5">
                                  <span className="font-mono font-bold text-slate-900">
                                    {row.rekening.kodeRekening}
                                  </span>{' '}
                                  — <span className="text-slate-700">{row.rekening.uraian}</span>
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2 text-center font-mono tabular-nums">
                                  {row.rekening.tahunAnggaran}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2 text-right font-mono tabular-nums">
                                  {row.jumlahPaket}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                                  {formatRupiah(row.rekening.paguAnggaran)}
                                </td>
                                <td className="border-r border-slate-800 py-1.5 px-2.5 text-right font-mono text-emerald-800 tabular-nums whitespace-nowrap">
                                  {formatRupiah(row.totalNilaiKontrak)}
                                </td>
                                <td
                                  className={`border-r border-slate-800 py-1.5 px-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                                    row.isOverBudget ? 'text-rose-700' : 'text-slate-900'
                                  }`}
                                >
                                  {row.isOverBudget ? '-' : ''}
                                  {formatRupiah(Math.abs(row.sisaPagu))}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums">
                                  {row.serapanPersen}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {filteredList.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2 print:break-inside-avoid">
                      {jenisSummaries.map((item) => (
                        <div
                          key={item.jenisPelaksanaan}
                          className="px-3 py-2 border border-slate-800 bg-slate-50/70 text-[10px] flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-slate-900 uppercase">
                              {item.jenisPelaksanaan}
                            </div>
                            <div className="text-slate-600 tabular-nums mt-0.5">
                              {item.totalPaket} paket · {item.selesai} tuntas
                            </div>
                          </div>
                          <div className="font-mono font-bold text-slate-900 tabular-nums text-right">
                            {formatRupiah(item.totalAnggaran)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Official Printable Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-800 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-800 font-bold uppercase text-slate-900">
                      <th className="border border-slate-800 p-2 text-center w-8">No.</th>
                      <th className="border border-slate-800 p-2 text-center w-12">TA</th>
                      <th className="border border-slate-800 p-2">
                        Kegiatan, Sub Kegiatan &amp; Pekerjaan
                      </th>
                      <th className="border border-slate-800 p-2">Pelaksanaan &amp; Kontrak</th>
                      <th className="border border-slate-800 p-2 text-right whitespace-nowrap">
                        Pagu Anggaran
                      </th>
                      <th className="border border-slate-800 p-2 text-right whitespace-nowrap">
                        Nilai Kontrak
                      </th>
                      <th className="border border-slate-800 p-2 whitespace-nowrap">
                        Pencairan &amp; Termin
                      </th>
                      <th className="border border-slate-800 p-2">Jadwal &amp; Durasi</th>
                      <th className="border border-slate-800 p-2">Progres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((paket, idx) => {
                      const progress = computePaketProgress(paket, todayIso);
                      const terminInfo = summarizeTerminPencairan(paket);
                      const paguInfo = resolvePaketPaguInfo(paket, rekeningList);
                      const maminInfo = summarizeMakananMinuman({
                        ...paket,
                        kodeRekening: paguInfo.kodeRekening || paket.kodeRekening,
                        namaRekening: paguInfo.namaRekening || paket.namaRekening,
                      });
                      const sharedCount = sharedCountByDedupeKey.get(paguInfo.dedupeKey) || 1;
                      return (
                        <React.Fragment key={paket.id}>
                          <tr className="align-top print:break-inside-avoid">
                            <td className="border border-slate-800 p-2 text-center font-mono tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-800 p-2 text-center font-mono font-bold tabular-nums">
                              {getPaketTahunAnggaran(paket)}
                            </td>
                            <td className="border border-slate-800 p-2">
                              {paguInfo.hasRekening && paguInfo.kodeRekening && (
                                <div className="font-mono text-[9px] font-bold text-emerald-900 mb-0.5">
                                  Rek: {paguInfo.kodeRekening}
                                  {paguInfo.namaRekening ? ` (${paguInfo.namaRekening})` : ''}
                                </div>
                              )}
                              <div className="font-bold text-slate-900">{paket.namaKegiatan}</div>
                              <div className="text-slate-700 mt-0.5">{paket.subKegiatan}</div>
                              {paket.pekerjaan && (
                                <div className="font-semibold text-slate-900 mt-0.5">
                                  {paket.pekerjaan}
                                </div>
                              )}
                              {maminInfo.isActive &&
                                (maminInfo.jumlahPax !== undefined ||
                                  maminInfo.hargaPerPax !== undefined ||
                                  maminInfo.hargaRealisasi !== undefined) && (
                                  <div className="mt-1 px-1.5 py-0.5 bg-amber-50 border border-amber-300 text-[9px] text-slate-900 tabular-nums">
                                    <span className="font-bold text-amber-900">Mamin (At Cost):</span>{' '}
                                    {maminInfo.jumlahPax !== undefined &&
                                    maminInfo.hargaPerPax !== undefined
                                      ? `${maminInfo.jumlahPax.toLocaleString('id-ID')} pax × ${formatRupiah(maminInfo.hargaPerPax)}/pax`
                                      : ''}
                                    {maminInfo.estimasiTotal !== undefined
                                      ? ` · Est. ${formatRupiah(maminInfo.estimasiTotal)}`
                                      : ''}
                                    {maminInfo.hargaRealisasi !== undefined
                                      ? ` · Realisasi: ${formatRupiah(maminInfo.hargaRealisasi)}${
                                          maminInfo.realisasiPerPax !== undefined
                                            ? ` (${formatRupiah(maminInfo.realisasiPerPax)}/pax)`
                                            : ''
                                        }`
                                      : ''}
                                  </div>
                                )}
                              {(paket.kodeRup || paket.nomorKontrak || paket.penyedia) && (
                                <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                                  {[
                                    paket.kodeRup ? `RUP: ${paket.kodeRup}` : '',
                                    paket.nomorKontrak ? `No. ${paket.nomorKontrak}` : '',
                                    paket.penyedia || '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-800 p-2">
                              <div className="font-semibold">{paket.jenisPelaksanaan}</div>
                              {paket.skemaKontrak && (
                                <div className="text-indigo-800 font-medium mt-0.5">
                                  {paket.skemaKontrak}
                                </div>
                              )}
                              {paket.picNama && (
                                <div className="text-slate-600 mt-0.5">PIC: {paket.picNama}</div>
                              )}
                            </td>
                            <td className="border border-slate-800 p-2 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                              <div>{formatRupiah(paguInfo.paguAnggaran)}</div>
                              {paguInfo.hasRekening && sharedCount > 1 && (
                                <div className="font-sans text-[8px] font-medium text-slate-600">
                                  Pagu Bersama ({sharedCount} keg.)
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-800 p-2 text-right font-mono tabular-nums whitespace-nowrap">
                              {typeof paket.nilaiKontrak === 'number'
                                ? formatRupiah(paket.nilaiKontrak)
                                : '-'}
                            </td>
                            <td className="border border-slate-800 p-2">
                              <div className="font-bold whitespace-nowrap">
                                {terminInfo.summaryLabel}
                              </div>
                              {terminInfo.skemaPembayaran === 'Sekaligus' &&
                                paket.tanggalPencairan && (
                                  <div className="text-[9px] text-slate-700 mt-0.5 tabular-nums">
                                    Tgl Cair: {formatTanggalDisplay(paket.tanggalPencairan)}
                                  </div>
                                )}
                              {terminInfo.sudahCount > 0 && terminInfo.hasNominalCair && (
                                <div className="font-mono text-[9px] font-bold text-emerald-800 mt-0.5 tabular-nums whitespace-nowrap">
                                  Sudah Dibayar: {formatRupiah(terminInfo.totalNilaiCair)}
                                </div>
                              )}
                              <div className="text-[9px] text-slate-700 mt-0.5">
                                {terminInfo.skemaPembayaran}
                                {paket.mekanismePencairan ? ` · ${paket.mekanismePencairan}` : ''}
                              </div>
                              {terminInfo.skemaPembayaran === 'Termin' &&
                                Array.isArray(paket.terminPencairan) &&
                                paket.terminPencairan.length > 0 && (
                                  <div className="mt-1 space-y-0.5 text-[9px] text-slate-700">
                                    {paket.terminPencairan.map((tr) => {
                                      const nom = resolveTerminNominal(tr, paket.nilaiKontrak);
                                      return (
                                        <div key={tr.id} className="leading-tight">
                                          {tr.urutan}. {tr.nama}:{' '}
                                          <span className="font-semibold">{tr.status}</span>
                                          {typeof tr.persentase === 'number'
                                            ? ` (${tr.persentase}%)`
                                            : ''}
                                          {tr.status === 'Sudah' && nom !== undefined
                                            ? ` · ${formatRupiah(nom)}`
                                            : ''}
                                          {tr.tanggalCair
                                            ? ` · Cair ${formatTanggalDdMmYyyy(tr.tanggalCair)}`
                                            : ''}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                            </td>
                            <td className="border border-slate-800 p-2 tabular-nums whitespace-nowrap">
                              <div>Mulai: {formatTanggalDisplay(paket.tanggalMulai)}</div>
                              <div className="font-mono">
                                Durasi: {progress.durasiHariKerja} hari kalender
                              </div>
                              <div className="font-bold">
                                Selesai: {formatTanggalDisplay(paket.tenggatWaktu)}
                              </div>
                            </td>
                            <td className="border border-slate-800 p-2 tabular-nums">
                              <div className="font-mono font-bold">
                                {progress.persentase}% ({progress.selesaiCount}/{progress.totalTahapan})
                              </div>
                              <div className="font-semibold">{progress.overallStatusLabel}</div>
                            </td>
                          </tr>
                          {includeTahapan && paket.tahapan.length > 0 && (
                            <tr className="bg-slate-50/70 print:break-inside-avoid">
                              <td colSpan={9} className="border border-slate-800 px-3 py-1.5">
                                <span className="font-bold text-slate-800 mr-1.5">
                                  Alur Tahapan:
                                </span>
                                <span className="text-slate-700">
                                  {paket.tahapan
                                    .map(
                                      (t) =>
                                        `${t.urutan}. ${t.nama} [${stageStatusLabel(t.status)}${
                                          t.tanggalSelesai
                                            ? ` · ${formatTanggalDdMmYyyy(t.tanggalSelesai)}`
                                            : ''
                                        }]`
                                    )
                                    .join(' | ')}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td colSpan={4} className="border border-slate-800 p-2 text-right uppercase">
                        Jumlah Total ({stats.totalPaket} Kegiatan
                        {stats.jumlahRekeningUnik > 0
                          ? ` · ${stats.jumlahRekeningUnik} Rekening Unik`
                          : ''}
                        )
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRupiah(stats.totalAnggaran)}
                      </td>
                      <td className="border border-slate-800 p-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {stats.totalNilaiKontrak > 0 ? formatRupiah(stats.totalNilaiKontrak) : '-'}
                      </td>
                      <td colSpan={3} className="border border-slate-800 p-2 font-mono tabular-nums">
                        <div>
                          Sudah Cair: {stats.sudahCairCount} · Belum: {stats.belumCairCount}
                        </div>
                        {stats.totalNilaiSudahCair > 0 && (
                          <div className="text-[9px] text-emerald-800 mt-0.5">
                            Total Sudah Dibayar: {formatRupiah(stats.totalNilaiSudahCair)}
                          </div>
                        )}
                      </td>
                    </tr>
                    {stats.jumlahRekeningUnik > 0 && (
                      <tr className="bg-slate-50 text-[9px] text-slate-700">
                        <td colSpan={9} className="border border-slate-800 px-2.5 py-1.5">
                          <span className="font-semibold">Catatan Perhitungan Pagu:</span> Total Pagu
                          Anggaran ({formatRupiah(stats.totalAnggaran)}) dihitung 1x per Kode
                          Rekening dan tidak digandakan untuk kegiatan yang berbagi rekening yang
                          sama. Sisa Pagu Total:{' '}
                          <span className="font-mono font-bold">
                            {stats.sisaPaguTotal < 0 ? '-' : ''}
                            {formatRupiah(Math.abs(stats.sisaPaguTotal))}
                          </span>
                          .
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {includeTtd && (
                <div className="grid grid-cols-2 gap-6 pt-4 text-xs font-sans print:break-inside-avoid">
                  <div className="text-center space-y-12">
                    <div>
                      <div className="font-semibold text-slate-700">Mengetahui,</div>
                      <div className="font-bold text-slate-900">
                        {pejabatConfig.kepalaBidang.jabatan}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold underline text-slate-900">
                        {pejabatConfig.kepalaBidang.nama}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        NIP. {pejabatConfig.kepalaBidang.nip}
                      </div>
                    </div>
                  </div>
                  <div className="text-center space-y-12">
                    <div>
                      <div className="font-semibold text-slate-700">
                        Bandung, {printedDateText}
                      </div>
                      <div className="font-bold text-slate-900">
                        {pejabatConfig.ketuaTim.jabatan}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold underline text-slate-900">
                        {pejabatConfig.ketuaTim.nama}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        NIP. {pejabatConfig.ketuaTim.nip}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* KARTU KENDALI MODE */
            <div className="space-y-8">
              {activeItems.map((paket, cardIdx) => {
                const progress = computePaketProgress(paket, todayIso);
                const terminInfo = summarizeTerminPencairan(paket);
                const paguInfo = resolvePaketPaguInfo(paket, rekeningList);
                const maminInfo = summarizeMakananMinuman({
                  ...paket,
                  kodeRekening: paguInfo.kodeRekening || paket.kodeRekening,
                  namaRekening: paguInfo.namaRekening || paket.namaRekening,
                });

                return (
                  <div
                    key={paket.id}
                    className={`border border-slate-300 rounded-xl p-5 space-y-4 print:border-0 print:p-0 ${
                      cardIdx < activeItems.length - 1 ? 'print:break-after-page' : ''
                    }`}
                  >
                    {/* KOP Resmi */}
                    <div className="text-center border-b-4 border-double border-slate-900 pb-3 font-serif">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-700">
                        Pemerintah Kota Bandung
                      </div>
                      <div className="text-sm font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
                        {pejabatConfig.kepalaDinas.instansi}
                      </div>
                      <div className="text-[11px] font-bold uppercase text-slate-800">
                        Kartu Kendali Pelaksanaan Kegiatan &amp; Pekerjaan
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-100 border border-slate-800 px-3 py-2">
                      <div>
                        <span className="font-bold uppercase">Tahun Anggaran:</span>{' '}
                        <span className="font-mono font-bold">{getPaketTahunAnggaran(paket)}</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Status Paket:</span>{' '}
                        <span className="font-bold">
                          {progress.overallStatusLabel} ({progress.persentase}%)
                        </span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Tanggal Cetak:</span> {printedDateText}
                      </div>
                    </div>

                    {/* Two-column Spec Table */}
                    <table className="w-full border-collapse border border-slate-800 text-[11px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50 w-1/5">
                            Kode Rekening
                          </td>
                          <td colSpan={3} className="border border-slate-800 p-2 font-mono">
                            {paguInfo.hasRekening && paguInfo.kodeRekening
                              ? `${paguInfo.kodeRekening}${
                                  paguInfo.namaRekening ? ` — ${paguInfo.namaRekening}` : ''
                                }`
                              : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50 w-1/5">
                            Nama Kegiatan
                          </td>
                          <td className="border border-slate-800 p-2 w-[30%] font-semibold">
                            {paket.namaKegiatan}
                          </td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50 w-1/5">
                            Pagu Anggaran Rekening
                          </td>
                          <td className="border border-slate-800 p-2 w-[30%] font-mono font-bold tabular-nums">
                            {formatRupiah(paguInfo.paguAnggaran)}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Sub Kegiatan
                          </td>
                          <td className="border border-slate-800 p-2">{paket.subKegiatan}</td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Nilai Kontrak / Realisasi
                          </td>
                          <td className="border border-slate-800 p-2 font-mono font-bold text-emerald-800 tabular-nums">
                            {typeof paket.nilaiKontrak === 'number'
                              ? formatRupiah(paket.nilaiKontrak)
                              : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Pekerjaan
                          </td>
                          <td className="border border-slate-800 p-2 font-medium">
                            {paket.pekerjaan || '-'}
                          </td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Skema Pembayaran
                          </td>
                          <td className="border border-slate-800 p-2 font-semibold">
                            {terminInfo.skemaPembayaran === 'Termin'
                              ? `Bertahap (${terminInfo.totalTermin} Termin)`
                              : 'Sekaligus (Tanpa Termin)'}
                          </td>
                        </tr>
                        {maminInfo.isActive &&
                          (maminInfo.jumlahPax !== undefined ||
                            maminInfo.hargaPerPax !== undefined ||
                            maminInfo.hargaRealisasi !== undefined) && (
                            <tr>
                              <td className="border border-slate-800 p-2 font-bold bg-amber-50">
                                Rincian Makanan &amp; Minuman (SHS)
                              </td>
                              <td className="border border-slate-800 p-2 font-medium tabular-nums">
                                {maminInfo.jumlahPax !== undefined &&
                                maminInfo.hargaPerPax !== undefined
                                  ? `${maminInfo.jumlahPax.toLocaleString('id-ID')} pax × ${formatRupiah(maminInfo.hargaPerPax)}/pax${
                                      maminInfo.estimasiTotal !== undefined
                                        ? ` = ${formatRupiah(maminInfo.estimasiTotal)}`
                                        : ''
                                    }`
                                  : '-'}
                              </td>
                              <td className="border border-slate-800 p-2 font-bold bg-amber-50">
                                Harga Realisasi (At Cost)
                              </td>
                              <td className="border border-slate-800 p-2 font-bold text-emerald-800 tabular-nums">
                                {maminInfo.hargaRealisasi !== undefined
                                  ? `${formatRupiah(maminInfo.hargaRealisasi)}${
                                      maminInfo.realisasiPerPax !== undefined
                                        ? ` (${formatRupiah(maminInfo.realisasiPerPax)}/pax)`
                                        : ''
                                    }`
                                  : '-'}
                              </td>
                            </tr>
                          )}
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Pelaksanaan &amp; Skema
                          </td>
                          <td className="border border-slate-800 p-2">
                            {paket.jenisPelaksanaan}
                            {paket.skemaKontrak ? ` · ${paket.skemaKontrak}` : ''}
                          </td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Tahapan &amp; Mekanisme Pencairan
                          </td>
                          <td className="border border-slate-800 p-2 font-semibold">
                            {terminInfo.summaryLabel}
                            {terminInfo.skemaPembayaran === 'Sekaligus' && paket.tanggalPencairan
                              ? ` · Tgl Cair: ${formatTanggalDisplay(paket.tanggalPencairan)}`
                              : ''}
                            {terminInfo.sudahCount > 0 && terminInfo.hasNominalCair
                              ? ` · Dibayar ${formatRupiah(terminInfo.totalNilaiCair)}`
                              : ''}
                            {paket.mekanismePencairan ? ` · ${paket.mekanismePencairan}` : ''}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Kode RUP &amp; No. Kontrak
                          </td>
                          <td className="border border-slate-800 p-2 font-mono">
                            RUP: {paket.kodeRup || '-'} · Kontrak: {paket.nomorKontrak || '-'}
                          </td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Jadwal Pelaksanaan
                          </td>
                          <td className="border border-slate-800 p-2 tabular-nums">
                            Mulai {formatTanggalDisplay(paket.tanggalMulai)} ({progress.durasiHariKerja}{' '}
                            hari kalender) → Selesai {formatTanggalDisplay(paket.tenggatWaktu)}
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Penyedia / Pelaksana
                          </td>
                          <td className="border border-slate-800 p-2">{paket.penyedia || '-'}</td>
                          <td className="border border-slate-800 p-2 font-bold bg-slate-50">
                            Penanggung Jawab (PIC)
                          </td>
                          <td className="border border-slate-800 p-2">{paket.picNama || '-'}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Termin Breakdown Table (when Skema Pembayaran === 'Termin') */}
                    {terminInfo.skemaPembayaran === 'Termin' &&
                      Array.isArray(paket.terminPencairan) &&
                      paket.terminPencairan.length > 0 && (
                        <div className="space-y-1.5 print:break-inside-avoid">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase text-slate-900">
                            <span>
                              Rincian Termin Pembayaran ({terminInfo.sudahCount}/
                              {terminInfo.totalTermin} Termin Cair)
                            </span>
                            {terminInfo.sudahCount > 0 && terminInfo.hasNominalCair && (
                              <span className="font-mono text-emerald-800">
                                Total Sudah Dibayar: {formatRupiah(terminInfo.totalNilaiCair)}
                              </span>
                            )}
                          </div>
                          <table className="w-full border-collapse border border-slate-800 text-[10px]">
                            <thead>
                              <tr className="bg-slate-100 font-bold uppercase">
                                <th className="border border-slate-800 p-1.5 text-center w-8">No.</th>
                                <th className="border border-slate-800 p-1.5">Nama Termin</th>
                                <th className="border border-slate-800 p-1.5 text-right w-20">
                                  Persentase
                                </th>
                                <th className="border border-slate-800 p-1.5 text-right w-32">
                                  Nilai (Rp)
                                </th>
                                <th className="border border-slate-800 p-1.5 text-center w-28">
                                  Tanggal Cair
                                </th>
                                <th className="border border-slate-800 p-1.5 text-center w-24">
                                  Status
                                </th>
                                <th className="border border-slate-800 p-1.5">Keterangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paket.terminPencairan.map((tr) => {
                                const trNominal = resolveTerminNominal(tr, paket.nilaiKontrak);
                                return (
                                  <tr key={tr.id}>
                                    <td className="border border-slate-800 p-1.5 text-center font-mono">
                                      {tr.urutan}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 font-medium">
                                      {tr.nama}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 text-right font-mono tabular-nums">
                                      {typeof tr.persentase === 'number' ? `${tr.persentase}%` : '-'}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 text-right font-mono tabular-nums">
                                      {trNominal !== undefined ? formatRupiah(trNominal) : '-'}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 text-center font-mono">
                                      {tr.tanggalCair ? formatTanggalDdMmYyyy(tr.tanggalCair) : '-'}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 text-center font-bold">
                                      {tr.status}
                                    </td>
                                    <td className="border border-slate-800 p-1.5 text-slate-700">
                                      {tr.catatan || '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 font-bold text-slate-900">
                                <td colSpan={2} className="border border-slate-800 p-1.5 text-right uppercase">
                                  Total Sudah Dibayar ({terminInfo.sudahCount}/{terminInfo.totalTermin} Termin)
                                </td>
                                <td className="border border-slate-800 p-1.5 text-right font-mono tabular-nums">
                                  {terminInfo.totalPersenCair > 0 ? `${terminInfo.totalPersenCair}%` : '-'}
                                </td>
                                <td className="border border-slate-800 p-1.5 text-right font-mono text-emerald-800 tabular-nums">
                                  {terminInfo.hasNominalCair
                                    ? formatRupiah(terminInfo.totalNilaiCair)
                                    : '-'}
                                </td>
                                <td colSpan={3} className="border border-slate-800 p-1.5" />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                    {/* Stage Breakdown Table */}
                    {includeTahapan && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase text-slate-900">
                          Rincian Alur Tahapan Pekerjaan ({progress.selesaiCount}/
                          {progress.totalTahapan} Selesai)
                        </div>
                        <table className="w-full border-collapse border border-slate-800 text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 font-bold uppercase">
                              <th className="border border-slate-800 p-1.5 text-center w-8">No.</th>
                              <th className="border border-slate-800 p-1.5">Nama Tahapan</th>
                              <th className="border border-slate-800 p-1.5 w-28 text-center">
                                Status
                              </th>
                              <th className="border border-slate-800 p-1.5 w-28 text-center">
                                Target
                              </th>
                              <th className="border border-slate-800 p-1.5 w-28 text-center">
                                Selesai Aktual
                              </th>
                              <th className="border border-slate-800 p-1.5">
                                Catatan / Dokumen Output
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paket.tahapan.map((t) => (
                              <tr key={t.id}>
                                <td className="border border-slate-800 p-1.5 text-center font-mono">
                                  {t.urutan}
                                </td>
                                <td className="border border-slate-800 p-1.5 font-medium">
                                  {t.nama}
                                </td>
                                <td className="border border-slate-800 p-1.5 text-center font-semibold">
                                  {stageStatusLabel(t.status)}
                                </td>
                                <td className="border border-slate-800 p-1.5 text-center font-mono">
                                  {t.tanggalTarget ? formatTanggalDdMmYyyy(t.tanggalTarget) : '-'}
                                </td>
                                <td className="border border-slate-800 p-1.5 text-center font-mono">
                                  {t.tanggalSelesai ? formatTanggalDdMmYyyy(t.tanggalSelesai) : '-'}
                                </td>
                                <td className="border border-slate-800 p-1.5 text-slate-700">
                                  {t.catatan || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {paket.catatan && (
                      <div className="p-2.5 border border-slate-800 bg-slate-50 text-[11px]">
                        <span className="font-bold">Catatan Paket:</span> {paket.catatan}
                      </div>
                    )}

                    {includeTtd && (
                      <div className="grid grid-cols-2 gap-6 pt-3 text-xs font-sans print:break-inside-avoid">
                        <div className="text-center space-y-10">
                          <div>
                            <div className="font-semibold text-slate-700">Mengetahui,</div>
                            <div className="font-bold text-slate-900">
                              {pejabatConfig.kepalaBidang.jabatan}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold underline text-slate-900">
                              {pejabatConfig.kepalaBidang.nama}
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                              NIP. {pejabatConfig.kepalaBidang.nip}
                            </div>
                          </div>
                        </div>
                        <div className="text-center space-y-10">
                          <div>
                            <div className="font-semibold text-slate-700">
                              Bandung, {printedDateText}
                            </div>
                            <div className="font-bold text-slate-900">
                              {pejabatConfig.ketuaTim.jabatan}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold underline text-slate-900">
                              {pejabatConfig.ketuaTim.nama}
                            </div>
                            <div className="text-[10px] font-mono text-slate-600">
                              NIP. {pejabatConfig.ketuaTim.nip}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
