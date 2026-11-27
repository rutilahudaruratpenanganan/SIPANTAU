import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  JenisPelaksanaan,
  PaketPekerjaan,
  Personel,
  RekeningAnggaran,
  Role,
  SkemaPembayaran,
  StatusPencairan,
} from '../types';
import {
  JENIS_PELAKSANAAN_LIST,
  PaketOverallStatus,
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
  getAvailableTahunAnggaran,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  normalizeKodeRekening,
  resolvePaketPaguInfo,
  resolveTerminNominal,
  summarizeRekeningAnggaran,
  summarizeTerminPencairan,
} from '../utils/pekerjaanLogic';

interface PekerjaanViewProps {
  paketList: PaketPekerjaan[];
  rekeningList: RekeningAnggaran[];
  personelList: Personel[];
  currentUser: Personel;
  currentRole: Role;
  onOpenCreate: () => void;
  onOpenEdit: (paket: PaketPekerjaan) => void;
  onOpenWorkflow: (paket: PaketPekerjaan) => void;
  onOpenKelolaRekening: () => void;
  onOpenPrint?: (opts: {
    selectedPaketId?: string;
    kodeRekening?: string | 'all';
    tahunAnggaran: number | 'all';
    jenisPelaksanaan: JenisPelaksanaan | 'all';
    skemaPembayaran?: SkemaPembayaran | 'all';
    statusPencairan: StatusPencairan | 'all';
    status: PaketOverallStatus | 'all';
    searchQuery: string;
  }) => void;
  onDeletePaket: (paketId: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const PekerjaanView: React.FC<PekerjaanViewProps> = ({
  paketList,
  rekeningList,
  onOpenCreate,
  onOpenEdit,
  onOpenWorkflow,
  onOpenKelolaRekening,
  onOpenPrint,
  onDeletePaket,
  onNotify,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKodeRekening, setSelectedKodeRekening] = useState<string | 'all'>('all');
  const [selectedTahun, setSelectedTahun] = useState<number | 'all'>('all');
  const [selectedJenis, setSelectedJenis] = useState<JenisPelaksanaan | 'all'>('all');
  const [selectedSkemaPembayaran, setSelectedSkemaPembayaran] = useState<SkemaPembayaran | 'all'>('all');
  const [selectedPencairan, setSelectedPencairan] = useState<StatusPencairan | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<PaketOverallStatus | 'all'>('all');
  const [showRekeningStrip, setShowRekeningStrip] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const availableYears = useMemo(
    () => getAvailableTahunAnggaran(paketList, rekeningList),
    [paketList, rekeningList]
  );

  const rekeningFilterOptions = useMemo(
    () => getAvailableKodeRekeningOptions(paketList, rekeningList, selectedTahun),
    [paketList, rekeningList, selectedTahun]
  );

  const rekeningSummaries = useMemo(
    () =>
      summarizeRekeningAnggaran(rekeningList, paketList, todayIso).filter(
        (s) => selectedTahun === 'all' || s.rekening.tahunAnggaran === selectedTahun
      ),
    [rekeningList, paketList, todayIso, selectedTahun]
  );

  const sharedCountByDedupeKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of paketList) {
      const info = resolvePaketPaguInfo(p, rekeningList);
      counts.set(info.dedupeKey, (counts.get(info.dedupeKey) || 0) + 1);
    }
    return counts;
  }, [paketList, rekeningList]);

  const stats = useMemo(
    () => calculatePekerjaanStats(paketList, todayIso, rekeningList),
    [paketList, todayIso, rekeningList]
  );

  const filteredList = useMemo(
    () =>
      filterPaketPekerjaan(
        paketList,
        {
          searchQuery,
          kodeRekening: selectedKodeRekening,
          tahunAnggaran: selectedTahun,
          jenisPelaksanaan: selectedJenis,
          skemaPembayaran: selectedSkemaPembayaran,
          statusPencairan: selectedPencairan,
          status: selectedStatus,
        },
        todayIso,
        rekeningList
      ),
    [
      paketList,
      rekeningList,
      searchQuery,
      selectedKodeRekening,
      selectedTahun,
      selectedJenis,
      selectedSkemaPembayaran,
      selectedPencairan,
      selectedStatus,
      todayIso,
    ]
  );

  const handleExportCsv = () => {
    const csv = buildPekerjaanCsvContent(filteredList, todayIso, rekeningList);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Pemantauan_Kegiatan_Pekerjaan_${todayIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`Rekap CSV (${filteredList.length} paket pekerjaan) berhasil diunduh.`);
  };

  const handleConfirmDelete = async (paket: PaketPekerjaan) => {
    setIsDeletingId(paket.id);
    try {
      await onDeletePaket(paket.id);
      setConfirmDeleteId(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal menghapus paket pekerjaan.'
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Kegiatan &amp; Pekerjaan
          </h1>
          <p className="text-xs text-slate-500">
            Pantau paket kegiatan, pagu anggaran, durasi hari kalender, dan progres alur tahapan pelaksanaan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenKelolaRekening}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Landmark className="w-4 h-4 text-emerald-700" />
            <span>Kelola Kode Rekening ({rekeningList.length})</span>
          </button>
          {onOpenPrint && (
            <button
              type="button"
              onClick={() =>
                onOpenPrint({
                  kodeRekening: selectedKodeRekening,
                  tahunAnggaran: selectedTahun,
                  jenisPelaksanaan: selectedJenis,
                  skemaPembayaran: selectedSkemaPembayaran,
                  statusPencairan: selectedPencairan,
                  status: selectedStatus,
                  searchQuery,
                })
              }
              disabled={paketList.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Cetak Pekerjaan</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Pekerjaan</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          data-testid="kpi-total-pagu"
          className="p-4 rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Pagu Anggaran (Unik)</span>
            <Wallet className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(stats.totalAnggaran)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums space-y-0.5">
            <div>
              {stats.jumlahRekeningUnik > 0
                ? `${stats.jumlahRekeningUnik} kode rekening · ${stats.totalPaket} kegiatan · Progres ${stats.rataRataProgres}%`
                : `${stats.totalPaket} paket terdaftar · Rata-rata progres ${stats.rataRataProgres}%`}
            </div>
            {stats.totalNilaiKontrak > 0 && (
              <div className="font-mono text-[10px] text-emerald-700">
                Total Kontrak: {formatRupiah(stats.totalNilaiKontrak)} · Sisa:{' '}
                <span className={stats.sisaPaguTotal < 0 ? 'text-rose-700 font-semibold' : ''}>
                  {stats.sisaPaguTotal < 0 ? '-' : ''}
                  {formatRupiah(Math.abs(stats.sisaPaguTotal))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <span className="text-xs font-medium">Sedang Berjalan</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 font-mono tabular-nums">
            {stats.sedangBerjalan}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {stats.belumMulai} belum mulai · Dalam proses tahapan
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-xs font-medium">Perhatian Jadwal Selesai</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono tabular-nums">
            {stats.terlambat + stats.mendekatiTenggat}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {stats.terlambat} lewat jadwal · {stats.mendekatiTenggat} mendekati (≤ 7 hari)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-medium">Pekerjaan Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums">
            {stats.selesai}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
            Realisasi: {formatRupiah(stats.anggaranSelesai)}
            {stats.kontrakSelesai > 0 ? ` · Kontrak ${formatRupiah(stats.kontrakSelesai)}` : ''}
          </div>
        </div>
      </div>

      {/* Ringkasan Pagu Per Kode Rekening (1 Rekening = 1 Pagu) */}
      {rekeningSummaries.length > 0 && (
        <div
          data-testid="rekening-summary-panel"
          className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">
                Rekap Pagu Per Kode Rekening ({rekeningSummaries.length})
              </span>
              <span className="text-[11px] text-slate-500">
                1 Kode Rekening = 1 Pagu Anggaran (tidak ditotal ulang per kegiatan)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={onOpenKelolaRekening}
                className="font-semibold text-emerald-700 hover:text-emerald-900 underline"
              >
                Kelola Rekening
              </button>
              <button
                type="button"
                onClick={() => setShowRekeningStrip((v) => !v)}
                className="font-semibold text-slate-600 hover:text-slate-900"
              >
                {showRekeningStrip ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
          </div>

          {showRekeningStrip && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {rekeningSummaries.map((item) => {
                const normKey = normalizeKodeRekening(item.rekening.kodeRekening);
                const isSelected =
                  selectedKodeRekening === normKey &&
                  selectedTahun === item.rekening.tahunAnggaran;
                return (
                  <button
                    key={item.rekening.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedKodeRekening('all');
                      } else {
                        setSelectedTahun(item.rekening.tahunAnggaran);
                        setSelectedKodeRekening(normKey);
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-all space-y-1.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[11px] text-slate-900 truncate">
                        {item.rekening.kodeRekening}
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                        TA {item.rekening.tahunAnggaran} · {item.jumlahPaket} keg
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 font-medium line-clamp-1">
                      {item.rekening.uraian}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums pt-0.5">
                      <span className="font-bold text-slate-900">
                        Pagu: {formatRupiah(item.rekening.paguAnggaran)}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.isOverBudget ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        Sisa: {item.isOverBudget ? '-' : ''}
                        {formatRupiah(Math.abs(item.sisaPagu))}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          item.isOverBudget ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, item.serapanPersen))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                      Terpakai Kontrak: {formatRupiah(item.totalNilaiKontrak)} ({item.serapanPersen}%)
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode rekening, kegiatan, sub kegiatan, pekerjaan, RUP, PIC..."
              aria-label="Cari paket pekerjaan"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {rekeningFilterOptions.length > 0 && (
            <select
              aria-label="Filter kode rekening"
              value={selectedKodeRekening}
              onChange={(e) => setSelectedKodeRekening(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 max-w-[230px] focus:outline-none focus:ring-2 focus:ring-blue-600"
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
            aria-label="Filter tahun anggaran"
            value={selectedTahun === 'all' ? 'all' : String(selectedTahun)}
            onChange={(e) => {
              const nextTa = e.target.value === 'all' ? 'all' : Number(e.target.value);
              setSelectedTahun(nextTa);
              if (nextTa !== 'all' && selectedKodeRekening !== 'all') {
                const stillValid = getAvailableKodeRekeningOptions(
                  paketList,
                  rekeningList,
                  nextTa
                ).some((o) => o.key === selectedKodeRekening);
                if (!stillValid) {
                  setSelectedKodeRekening('all');
                }
              }
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Tahun Anggaran</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                TA {yr}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter jenis pelaksanaan"
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value as JenisPelaksanaan | 'all')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Jenis Pelaksanaan</option>
            {JENIS_PELAKSANAAN_LIST.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter skema pembayaran"
            value={selectedSkemaPembayaran}
            onChange={(e) => setSelectedSkemaPembayaran(e.target.value as SkemaPembayaran | 'all')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Skema Bayar</option>
            {SKEMA_PEMBAYARAN_LIST.map((sk) => (
              <option key={sk} value={sk}>
                {sk === 'Sekaligus' ? 'Sekaligus' : 'Termin'}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter tahapan pencairan"
            value={selectedPencairan}
            onChange={(e) => setSelectedPencairan(e.target.value as StatusPencairan | 'all')}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Semua Status Pencairan</option>
            {STATUS_PENCAIRAN_LIST.map((st) => (
              <option key={st} value={st}>
                Pencairan: {st}
              </option>
            ))}
          </select>
        </div>

        {/* Status Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'belum_mulai', label: 'Belum Mulai' },
              { id: 'sedang_berjalan', label: 'Berjalan' },
              { id: 'terlambat', label: 'Terlambat' },
              { id: 'selesai', label: 'Selesai' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {paketList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <BriefcaseBusiness className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-sm font-bold text-slate-900">
              Belum Ada Paket Kegiatan &amp; Pekerjaan
            </h2>
            <p className="text-xs text-slate-500">
              Tambahkan paket pekerjaan baru (Perorangan atau Badan Usaha) untuk memuat template
              alur tahapan otomatis dan memantau progresnya.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Pertama</span>
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Tidak ada paket pekerjaan yang sesuai dengan filter saat ini.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedKodeRekening('all');
              setSelectedTahun('all');
              setSelectedJenis('all');
              setSelectedSkemaPembayaran('all');
              setSelectedPencairan('all');
              setSelectedStatus('all');
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
          >
            Reset Filter Pencarian
          </button>
        </div>
      ) : (
        /* Populated List: Desktop Table + Mobile Cards */
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 pl-3 pr-1.5 min-w-[160px] max-w-[185px]">
                      Kegiatan, Sub Kegiatan &amp; Pekerjaan
                    </th>
                    <th className="py-2.5 px-1.5">Pelaksanaan &amp; Kontrak</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Pagu Anggaran</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Nilai HPS</th>
                    <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Nilai Kontrak</th>
                    <th className="py-2.5 px-1.5 whitespace-nowrap">Pencairan &amp; Termin</th>
                    <th className="py-2.5 px-1.5 whitespace-nowrap">Jadwal &amp; Durasi</th>
                    <th className="py-2.5 px-1.5 w-[135px]">Progres &amp; Alur Tahapan</th>
                    <th className="py-2.5 pl-1.5 pr-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredList.map((paket) => {
                    const progress = computePaketProgress(paket, todayIso);
                    const terminSummary = summarizeTerminPencairan(paket);
                    const paguInfo = resolvePaketPaguInfo(paket, rekeningList);
                    const sharedCount = sharedCountByDedupeKey.get(paguInfo.dedupeKey) || 1;
                    const statusColor =
                      progress.overallStatus === 'selesai'
                        ? 'text-emerald-700'
                        : progress.overallStatus === 'terlambat'
                        ? 'text-rose-700'
                        : progress.overallStatus === 'sedang_berjalan'
                        ? 'text-blue-700'
                        : 'text-slate-600';

                    return (
                      <tr
                        key={paket.id}
                        data-testid={`paket-row-${paket.id}`}
                        className="hover:bg-slate-50/80 transition-colors align-top"
                      >
                        <td className="py-3 pl-3 pr-1.5 min-w-[160px] max-w-[185px] break-words">
                          {paguInfo.hasRekening && paguInfo.kodeRekening && (
                            <div className="mb-1 flex flex-wrap items-center gap-1">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[10px] font-semibold text-emerald-800">
                                {paguInfo.kodeRekening}
                              </span>
                            </div>
                          )}
                          <div className="text-xs font-bold text-slate-900 leading-snug">
                            {paket.namaKegiatan}
                          </div>
                          <div className="text-slate-600 mt-0.5 leading-snug">
                            {paket.subKegiatan}
                          </div>
                          {paket.pekerjaan && (
                            <div className="text-slate-800 font-medium mt-0.5 leading-snug">
                              {paket.pekerjaan}
                            </div>
                          )}
                          {(paket.kodeRup || paket.nomorKontrak || paket.penyedia || paket.picNama) && (
                            <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                              {paket.kodeRup && (
                                <span className="font-mono text-slate-700 font-medium">
                                  RUP: {paket.kodeRup}
                                </span>
                              )}
                              {paket.kodeRup && (paket.nomorKontrak || paket.penyedia || paket.picNama) && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.nomorKontrak && (
                                <span className="font-mono break-all">No. {paket.nomorKontrak}</span>
                              )}
                              {paket.nomorKontrak && (paket.penyedia || paket.picNama) && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.penyedia && <span>{paket.penyedia}</span>}
                              {paket.penyedia && paket.picNama && (
                                <span aria-hidden="true">·</span>
                              )}
                              {paket.picNama && <span>PIC: {paket.picNama}</span>}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-1.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {paket.jenisPelaksanaan}
                          </div>
                          {paket.skemaKontrak && (
                            <div className="text-[10px] font-medium text-indigo-700 mt-0.5">
                              {paket.skemaKontrak}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-slate-500 tabular-nums mt-0.5">
                            TA {getPaketTahunAnggaran(paket)}
                          </div>
                          <div className={`text-[10px] font-semibold mt-0.5 ${statusColor}`}>
                            {progress.overallStatusLabel}
                          </div>
                        </td>

                        <td className="py-3 px-1.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          <div>{formatRupiah(paguInfo.paguAnggaran)}</div>
                          {paguInfo.hasRekening && sharedCount > 1 && (
                            <div className="font-sans text-[10px] font-medium text-emerald-700 mt-0.5">
                              Pagu Bersama ({sharedCount} keg.)
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {typeof paket.hps === 'number' ? (
                            <span className="font-semibold text-slate-800">
                              {formatRupiah(paket.hps)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {typeof paket.nilaiKontrak === 'number' ? (
                            <span className="font-semibold text-emerald-700">
                              {formatRupiah(paket.nilaiKontrak)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-1.5 min-w-[125px] max-w-[170px]">
                          <div
                            className={`text-[11px] font-semibold ${
                              terminSummary.isAllSudah
                                ? 'text-emerald-700'
                                : terminSummary.isPartial
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {terminSummary.skemaPembayaran === 'Termin'
                              ? terminSummary.summaryLabel
                              : terminSummary.compactLabel}
                          </div>
                          {terminSummary.skemaPembayaran === 'Sekaligus' &&
                            paket.tanggalPencairan && (
                              <div className="text-[10px] text-slate-600 mt-0.5 tabular-nums">
                                Tgl Cair: {formatTanggalDisplay(paket.tanggalPencairan)}
                              </div>
                            )}
                          {terminSummary.sudahCount > 0 && terminSummary.hasNominalCair && (
                            <div className="font-mono text-[11px] font-bold text-emerald-700 mt-0.5 tabular-nums">
                              Sudah Dibayar: {formatRupiah(terminSummary.totalNilaiCair)}
                              {terminSummary.skemaPembayaran === 'Termin' &&
                              terminSummary.totalPersenCair > 0
                                ? ` (${terminSummary.totalPersenCair}%)`
                                : ''}
                            </div>
                          )}
                          {terminSummary.skemaPembayaran === 'Termin' &&
                            terminSummary.sudahCount > 0 &&
                            !terminSummary.hasNominalCair && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Sudah Dibayar: Nilai termin belum diisi
                              </div>
                            )}
                          {terminSummary.skemaPembayaran === 'Termin' &&
                            paket.terminPencairan &&
                            paket.terminPencairan.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {paket.terminPencairan.map((tr) => {
                                  const trNominal = resolveTerminNominal(tr, paket.nilaiKontrak);
                                  return (
                                    <div key={tr.id} className="text-[10px] text-slate-600">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className="truncate">{tr.nama}</span>
                                        <span
                                          className={`font-semibold shrink-0 tabular-nums ${
                                            tr.status === 'Sudah'
                                              ? 'text-emerald-700'
                                              : 'text-slate-500'
                                          }`}
                                        >
                                          {tr.status === 'Sudah' && trNominal !== undefined
                                            ? `Sudah · ${formatRupiah(trNominal)}`
                                            : tr.status}
                                        </span>
                                      </div>
                                      {tr.tanggalCair && (
                                        <div className="text-[9px] text-slate-500 font-mono tabular-nums text-right leading-tight">
                                          Cair {formatTanggalDdMmYyyy(tr.tanggalCair)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          {paket.mekanismePencairan && (
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                              {paket.mekanismePencairan}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-1.5 whitespace-nowrap tabular-nums text-[11px] space-y-0.5">
                          <div className="text-slate-700">
                            Mulai: {formatTanggalDisplay(paket.tanggalMulai)}
                          </div>
                          <div className="text-slate-600 font-mono">
                            Durasi: {progress.durasiHariKerja} hari kalender
                          </div>
                          <div className="text-slate-900 font-semibold">
                            Selesai: {formatTanggalDisplay(paket.tenggatWaktu)}
                          </div>
                          {paket.tanggalSelesai && (
                            <div className="text-emerald-700 font-semibold">
                              Tuntas Aktual: {formatTanggalDisplay(paket.tanggalSelesai)}
                            </div>
                          )}
                          <div
                            className={`mt-0.5 font-sans font-semibold ${
                              progress.isOverdue
                                ? 'text-rose-700'
                                : progress.isNearDeadline
                                ? 'text-amber-700'
                                : progress.overallStatus === 'selesai'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {progress.deadlineLabel}
                          </div>
                        </td>

                        <td className="py-3 px-1.5 w-[135px] max-w-[145px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 text-[10px]">
                              <span className="font-medium text-slate-700 truncate">
                                {progress.activeStage
                                  ? `Tahap ${progress.activeStage.urutan}: ${progress.activeStage.nama}`
                                  : '-'}
                              </span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                                {progress.persentase}% ({progress.selesaiCount}/
                                {progress.totalTahapan})
                              </span>
                            </div>

                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  progress.overallStatus === 'selesai'
                                    ? 'bg-emerald-600'
                                    : progress.overallStatus === 'terlambat'
                                    ? 'bg-rose-600'
                                    : 'bg-blue-600'
                                }`}
                                style={{ width: `${progress.persentase}%` }}
                              />
                            </div>

                            {/* Compact stage trail */}
                            <div className="flex items-center gap-1 pt-0.5">
                              {paket.tahapan.map((t) => (
                                <span
                                  key={t.id}
                                  title={`${t.urutan}. ${t.nama} (${
                                    t.status === 'selesai'
                                      ? 'Selesai'
                                      : t.status === 'sedang_berjalan'
                                      ? 'Sedang Berjalan'
                                      : 'Belum Mulai'
                                  })`}
                                  className={`h-1.5 flex-1 rounded-sm ${
                                    t.status === 'selesai'
                                      ? 'bg-emerald-500'
                                      : t.status === 'sedang_berjalan'
                                      ? 'bg-blue-500'
                                      : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 pl-1.5 pr-2.5 text-right whitespace-nowrap">
                          {confirmDeleteId === paket.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(paket)}
                                disabled={isDeletingId === paket.id}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold"
                              >
                                {isDeletingId === paket.id ? 'Menghapus...' : 'Ya, Hapus'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[10px] font-semibold"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenWorkflow(paket)}
                                aria-label={`Edit per tahap ${paket.subKegiatan}`}
                                title="Edit per tahap pekerjaan"
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold transition-colors"
                              >
                                <Layers className="w-3 h-3" />
                                <span>Tahap</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenEdit(paket)}
                                aria-label={`Edit keseluruhan ${paket.subKegiatan}`}
                                title="Edit keseluruhan paket & tahapan"
                                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              {onOpenPrint && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPrint({
                                      selectedPaketId: paket.id,
                                      kodeRekening: selectedKodeRekening,
                                      tahunAnggaran: selectedTahun,
                                      jenisPelaksanaan: selectedJenis,
                                      skemaPembayaran: selectedSkemaPembayaran,
                                      statusPencairan: selectedPencairan,
                                      status: selectedStatus,
                                      searchQuery,
                                    })
                                  }
                                  aria-label={`Cetak kartu kendali ${paket.subKegiatan}`}
                                  title="Cetak Kartu Kendali Pekerjaan"
                                  className="inline-flex items-center justify-center p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-blue-700 transition-colors"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(paket.id)}
                                aria-label={`Hapus paket ${paket.subKegiatan}`}
                                title="Hapus Paket"
                                className="inline-flex items-center justify-center p-1 rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
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

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredList.map((paket) => {
              const progress = computePaketProgress(paket, todayIso);
              const terminSummary = summarizeTerminPencairan(paket);
              const paguInfo = resolvePaketPaguInfo(paket, rekeningList);
              const sharedCount = sharedCountByDedupeKey.get(paguInfo.dedupeKey) || 1;
              return (
                <div
                  key={paket.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {paguInfo.hasRekening && paguInfo.kodeRekening && (
                        <div className="mb-1">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[10px] font-semibold text-emerald-800">
                            {paguInfo.kodeRekening}
                          </span>
                        </div>
                      )}
                      <div className="font-bold text-slate-900">{paket.namaKegiatan}</div>
                      <div className="text-slate-600 mt-0.5">{paket.subKegiatan}</div>
                      {paket.pekerjaan && (
                        <div className="text-slate-800 font-medium mt-0.5">{paket.pekerjaan}</div>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        progress.overallStatus === 'selesai'
                          ? 'text-emerald-700'
                          : progress.overallStatus === 'terlambat'
                          ? 'text-rose-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {progress.overallStatusLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">{paket.jenisPelaksanaan}</span>
                    {paket.skemaKontrak && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-indigo-700">{paket.skemaKontrak}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-slate-700 tabular-nums">
                      TA {getPaketTahunAnggaran(paket)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Pagu: {formatRupiah(paguInfo.paguAnggaran)}
                      {paguInfo.hasRekening && sharedCount > 1
                        ? ` (Bersama ${sharedCount} keg.)`
                        : ''}
                    </span>
                    {typeof paket.hps === 'number' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-slate-800 tabular-nums">
                          HPS: {formatRupiah(paket.hps)}
                        </span>
                      </>
                    )}
                    {typeof paket.nilaiKontrak === 'number' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                          Kontrak: {formatRupiah(paket.nilaiKontrak)}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatTanggalDisplay(paket.tanggalMulai)} ({progress.durasiHariKerja} hari) →{' '}
                      {formatTanggalDisplay(paket.tenggatWaktu)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        terminSummary.isAllSudah
                          ? 'text-emerald-700'
                          : terminSummary.isPartial
                          ? 'text-blue-700'
                          : 'text-amber-700'
                      }`}
                    >
                      Pencairan: {terminSummary.summaryLabel}
                      {terminSummary.skemaPembayaran === 'Sekaligus' && paket.tanggalPencairan
                        ? ` · Tgl Cair ${formatTanggalDisplay(paket.tanggalPencairan)}`
                        : ''}
                      {terminSummary.sudahCount > 0 && terminSummary.hasNominalCair
                        ? ` · Sudah Dibayar ${formatRupiah(terminSummary.totalNilaiCair)}`
                        : ''}
                      {paket.mekanismePencairan ? ` (${paket.mekanismePencairan})` : ''}
                    </span>
                    {terminSummary.skemaPembayaran === 'Termin' &&
                      paket.terminPencairan &&
                      paket.terminPencairan.some((tr) => Boolean(tr.tanggalCair)) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600 font-mono tabular-nums">
                            {paket.terminPencairan
                              .filter((tr) => Boolean(tr.tanggalCair))
                              .map(
                                (tr) =>
                                  `${tr.nama}: Cair ${formatTanggalDdMmYyyy(tr.tanggalCair)}`
                              )
                              .join(' · ')}
                          </span>
                        </>
                      )}
                    {paket.kodeRup && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-700">RUP: {paket.kodeRup}</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 truncate">
                        {progress.activeStage
                          ? `Tahap ${progress.activeStage.urutan}: ${progress.activeStage.nama}`
                          : '-'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                        {progress.persentase}% ({progress.selesaiCount}/{progress.totalTahapan})
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${
                          progress.overallStatus === 'selesai'
                            ? 'bg-emerald-600'
                            : progress.overallStatus === 'terlambat'
                            ? 'bg-rose-600'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress.persentase}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {confirmDeleteId === paket.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(paket)}
                          disabled={isDeletingId === paket.id}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                          {isDeletingId === paket.id ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenWorkflow(paket)}
                          aria-label={`Edit per tahap ${paket.subKegiatan}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Edit Tahap</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(paket)}
                          aria-label={`Edit keseluruhan ${paket.subKegiatan}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Keseluruhan</span>
                        </button>
                        {onOpenPrint && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPrint({
                                selectedPaketId: paket.id,
                                kodeRekening: selectedKodeRekening,
                                tahunAnggaran: selectedTahun,
                                jenisPelaksanaan: selectedJenis,
                                skemaPembayaran: selectedSkemaPembayaran,
                                statusPencairan: selectedPencairan,
                                status: selectedStatus,
                                searchQuery,
                              })
                            }
                            aria-label={`Cetak kartu kendali ${paket.subKegiatan}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-blue-700 font-semibold"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(paket.id)}
                          aria-label={`Hapus paket ${paket.subKegiatan}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
