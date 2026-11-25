import React, { useMemo, useState } from 'react';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Calendar,
  History,
  FileText,
  FileCheck,
  AlertCircle,
  BriefcaseBusiness,
} from 'lucide-react';
import {
  DokumenFile,
  JenisPelaksanaan,
  PaketPekerjaan,
  PejabatConfig,
  SuratMasuk,
} from '../types';
import { TAHAP_TINDAK_LANJUT, normalizeRiwayatCatatan } from '../utils/disposisiLogic';
import {
  RekapDateBasis,
  RekapStatusFilter,
  filterRekapSurat,
  formatRekapPeriodeLabel,
  getAvailableSuratYears,
  getRekapDateBasisLabel,
  getRekapStatusLabel,
} from '../utils/rekapLogic';
import {
  JENIS_PELAKSANAAN_LIST,
  PaketOverallStatus,
  buildPekerjaanCsvContent,
  calculatePekerjaanStats,
  computePaketProgress,
  filterPaketPekerjaan,
  formatRupiah,
  getAvailableTahunAnggaran,
  getPaketTahunAnggaran,
  getTodayLocalIso,
  summarizePaketByJenis,
  summarizePaketByTahunAnggaran,
} from '../utils/pekerjaanLogic';

type RekapDomainMode = 'pekerjaan' | 'persuratan';

interface RekapViewProps {
  suratList: SuratMasuk[];
  paketList?: PaketPekerjaan[];
  pejabatConfig: PejabatConfig;
  onExportCsv: (filteredList?: SuratMasuk[], options?: { includeHistory?: boolean }) => void;
  onOpenPdfViewer: (file: DokumenFile) => void;
  onNotify?: (msg: string) => void;
}

export const RekapView: React.FC<RekapViewProps> = ({
  suratList,
  paketList = [],
  pejabatConfig,
  onExportCsv,
  onOpenPdfViewer,
  onNotify,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);
  const [domainMode, setDomainMode] = useState<RekapDomainMode>('pekerjaan');

  // --- State: Rekap Persuratan ---
  const [statusFilter, setStatusFilter] = useState<RekapStatusFilter>('all');
  const [dateBasis, setDateBasis] = useState<RekapDateBasis>('tanggalSurat');
  const [suratTahunFilter, setSuratTahunFilter] = useState<number | 'all'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [includeHistory, setIncludeHistory] = useState<boolean>(true);

  // --- State: Rekap Kegiatan & Pekerjaan ---
  const availablePaketYears = useMemo(
    () => getAvailableTahunAnggaran(paketList),
    [paketList]
  );
  const [selectedTahunAnggaran, setSelectedTahunAnggaran] = useState<number | 'all'>('all');
  const [selectedJenisPaket, setSelectedJenisPaket] = useState<JenisPelaksanaan | 'all'>('all');
  const [selectedStatusPaket, setSelectedStatusPaket] = useState<PaketOverallStatus | 'all'>('all');

  const availableSuratYears = useMemo(
    () => getAvailableSuratYears(suratList, dateBasis),
    [suratList, dateBasis]
  );

  const hasDateRangeError = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const hasActiveSuratFilter =
    statusFilter !== 'all' ||
    suratTahunFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const filteredSuratList = useMemo(() => {
    if (hasDateRangeError) return [];
    return filterRekapSurat(suratList, {
      status: statusFilter,
      tahun: suratTahunFilter,
      dateFrom,
      dateTo,
      dateBasis,
    });
  }, [suratList, statusFilter, suratTahunFilter, dateFrom, dateTo, dateBasis, hasDateRangeError]);

  const totalAllSurat = suratList.length;
  const totalSelesaiSuratAll = suratList.filter((s) => s.statusSelesai).length;
  const totalAktifSuratAll = suratList.filter((s) => !s.statusSelesai).length;
  const filteredAktifSuratCount = filteredSuratList.filter((s) => !s.statusSelesai).length;
  const filteredSelesaiSuratCount = filteredSuratList.filter((s) => s.statusSelesai).length;

  // --- Computed: Rekap Kegiatan & Pekerjaan ---
  const hasActivePaketFilter =
    selectedTahunAnggaran !== 'all' ||
    selectedJenisPaket !== 'all' ||
    selectedStatusPaket !== 'all';

  const filteredPaketList = useMemo(
    () =>
      filterPaketPekerjaan(
        paketList,
        {
          tahunAnggaran: selectedTahunAnggaran,
          jenisPelaksanaan: selectedJenisPaket,
          status: selectedStatusPaket,
        },
        todayIso
      ),
    [paketList, selectedTahunAnggaran, selectedJenisPaket, selectedStatusPaket, todayIso]
  );

  const paketStats = useMemo(
    () => calculatePekerjaanStats(filteredPaketList, todayIso),
    [filteredPaketList, todayIso]
  );

  const realisasiAnggaranPct =
    paketStats.totalAnggaran > 0
      ? Math.round((paketStats.anggaranSelesai / paketStats.totalAnggaran) * 100)
      : 0;

  const tahunSummaries = useMemo(
    () => summarizePaketByTahunAnggaran(paketList, todayIso),
    [paketList, todayIso]
  );

  const jenisSummaries = useMemo(
    () => summarizePaketByJenis(filteredPaketList, todayIso),
    [filteredPaketList, todayIso]
  );

  const handleResetSuratFilters = () => {
    setStatusFilter('all');
    setDateBasis('tanggalSurat');
    setSuratTahunFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleResetPaketFilters = () => {
    setSelectedTahunAnggaran('all');
    setSelectedJenisPaket('all');
    setSelectedStatusPaket('all');
  };

  const handleExportPaketCsv = () => {
    const csv = buildPekerjaanCsvContent(filteredPaketList, todayIso);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tahunTag =
      selectedTahunAnggaran === 'all' ? 'Semua_TA' : `TA_${selectedTahunAnggaran}`;
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Rekap_Kegiatan_Pekerjaan_${tahunTag}_${todayIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify?.(
      `Rekap CSV Kegiatan & Pekerjaan (${filteredPaketList.length} paket) berhasil diunduh.`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const printedDateText = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Top Banner & Mode Switcher (Hidden on print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setDomainMode('pekerjaan')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  domainMode === 'pekerjaan'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BriefcaseBusiness className="w-3.5 h-3.5 text-blue-600" />
                <span>Rekap Kegiatan &amp; Pekerjaan</span>
              </button>
              <button
                type="button"
                onClick={() => setDomainMode('persuratan')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  domainMode === 'persuratan'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                <span>Rekap Persuratan &amp; Disposisi</span>
              </button>
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                {domainMode === 'pekerjaan'
                  ? 'Rekapitulasi Kegiatan & Pekerjaan Per Tahun Anggaran'
                  : 'Rekapitulasi Persuratan & Disposisi Tim Wasdal'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {domainMode === 'pekerjaan'
                  ? 'Pilih Tahun Anggaran, jenis pelaksanaan, atau status untuk melihat ringkasan pagu, realisasi, serta cetak laporan resmi'
                  : 'Pilih filter status, tahun, dan rentang tanggal untuk mencetak laporan lengkap beserta riwayat proses tiap surat'}
              </p>
            </div>
          </div>

          {domainMode === 'pekerjaan' ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportPaketCsv}
                disabled={filteredPaketList.length === 0}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-slate-300 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Ekspor CSV ({filteredPaketList.length})</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={filteredPaketList.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Rekapitulasi ({filteredPaketList.length})</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onExportCsv(filteredSuratList, { includeHistory })}
                disabled={filteredSuratList.length === 0}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-slate-300 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Ekspor CSV ({filteredSuratList.length})</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={filteredSuratList.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Rekapitulasi ({filteredSuratList.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        {domainMode === 'pekerjaan' ? (
          <div className="pt-4 border-t border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* Tahun Anggaran Quick & Select */}
              <div className="lg:col-span-5 space-y-1.5">
                <label
                  htmlFor="rekap-tahun-anggaran"
                  className="font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Pilih Tahun Anggaran</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="rekap-tahun-anggaran"
                    value={
                      selectedTahunAnggaran === 'all' ? 'all' : String(selectedTahunAnggaran)
                    }
                    onChange={(e) =>
                      setSelectedTahunAnggaran(
                        e.target.value === 'all' ? 'all' : Number(e.target.value)
                      )
                    }
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="all">Semua Tahun Anggaran ({paketList.length})</option>
                    {availablePaketYears.map((yr) => {
                      const count = paketList.filter(
                        (p) => getPaketTahunAnggaran(p) === yr
                      ).length;
                      return (
                        <option key={yr} value={String(yr)}>
                          Tahun Anggaran {yr} ({count} paket)
                        </option>
                      );
                    })}
                  </select>

                  {availablePaketYears.length > 0 && (
                    <div
                      role="group"
                      aria-label="Pilih cepat tahun anggaran"
                      className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTahunAnggaran('all')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                          selectedTahunAnggaran === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua TA
                      </button>
                      {availablePaketYears.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedTahunAnggaran(yr)}
                          className={`px-2.5 py-1 rounded-md font-mono font-semibold tabular-nums transition-colors whitespace-nowrap ${
                            selectedTahunAnggaran === yr
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          TA {yr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Jenis Pelaksanaan */}
              <div className="lg:col-span-3 space-y-1.5">
                <label
                  htmlFor="rekap-jenis-pelaksanaan"
                  className="block font-semibold text-slate-700"
                >
                  Jenis Pelaksanaan
                </label>
                <select
                  id="rekap-jenis-pelaksanaan"
                  value={selectedJenisPaket}
                  onChange={(e) =>
                    setSelectedJenisPaket(e.target.value as JenisPelaksanaan | 'all')
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">Semua Jenis Pelaksanaan</option>
                  {JENIS_PELAKSANAAN_LIST.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status Paket + Reset */}
              <div className="lg:col-span-4 flex flex-wrap items-end justify-between gap-2">
                <div className="space-y-1.5 flex-1 min-w-[160px]">
                  <label
                    htmlFor="rekap-status-paket"
                    className="block font-semibold text-slate-700"
                  >
                    Status Progres
                  </label>
                  <select
                    id="rekap-status-paket"
                    value={selectedStatusPaket}
                    onChange={(e) =>
                      setSelectedStatusPaket(e.target.value as PaketOverallStatus | 'all')
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="all">Semua Status</option>
                    <option value="belum_mulai">Belum Mulai</option>
                    <option value="sedang_berjalan">Sedang Berjalan</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="selesai">Selesai</option>
                  </select>
                </div>

                {hasActivePaketFilter && (
                  <button
                    type="button"
                    onClick={handleResetPaketFilters}
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold inline-flex items-center gap-1.5 border border-slate-300 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Bar: Persuratan */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-12 gap-4 items-end text-xs">
              {/* Filter Status */}
              <div className="xl:col-span-4 space-y-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  Filter Status Tindak Lanjut
                </span>
                <div
                  role="group"
                  aria-label="Filter status cetak rekap"
                  className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                      statusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua ({totalAllSurat})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('selesai')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                      statusFilter === 'selesai'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Selesai ({totalSelesaiSuratAll})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('aktif')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                      statusFilter === 'aktif'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Proses ({totalAktifSuratAll})
                  </button>
                </div>
              </div>

              {/* Filter Tahun & Range Tanggal */}
              <div className="xl:col-span-6 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="rekap-surat-tahun" className="block font-semibold text-slate-700">
                    Tahun
                  </label>
                  <select
                    id="rekap-surat-tahun"
                    value={suratTahunFilter === 'all' ? 'all' : String(suratTahunFilter)}
                    onChange={(e) =>
                      setSuratTahunFilter(
                        e.target.value === 'all' ? 'all' : Number(e.target.value)
                      )
                    }
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="all">Semua Tahun</option>
                    {availableSuratYears.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="rekap-date-basis" className="block font-semibold text-slate-700">
                    Acuan Tanggal
                  </label>
                  <select
                    id="rekap-date-basis"
                    value={dateBasis}
                    onChange={(e) => setDateBasis(e.target.value as RekapDateBasis)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="tanggalSurat">Tanggal Surat</option>
                    <option value="tanggalDiterima">Tanggal Diterima</option>
                    <option value="tanggalDisposisi">Tanggal Disposisi</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="rekap-date-from"
                    className="font-semibold text-slate-700 flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Dari Tanggal</span>
                  </label>
                  <input
                    id="rekap-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="rekap-date-to"
                    className="font-semibold text-slate-700 flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sampai Tanggal</span>
                  </label>
                  <input
                    id="rekap-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Toggle History & Reset */}
              <div className="xl:col-span-2 flex flex-wrap xl:flex-col xl:items-end justify-between gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700 py-1">
                  <input
                    id="rekap-include-history"
                    type="checkbox"
                    checked={includeHistory}
                    onChange={(e) => setIncludeHistory(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cetak History Lengkap</span>
                </label>

                {hasActiveSuratFilter && (
                  <button
                    type="button"
                    onClick={handleResetSuratFilters}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold inline-flex items-center gap-1.5 border border-slate-300 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>
            </div>

            {hasDateRangeError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Rentang tanggal tidak valid: &ldquo;Dari Tanggal&rdquo; tidak boleh lebih akhir
                  daripada &ldquo;Sampai Tanggal&rdquo;.
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Printable Sheet View */}
      {domainMode === 'pekerjaan' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 space-y-6 print:border-none print:p-0">
          {/* Kop Resmi Laporan Kegiatan & Pekerjaan */}
          <div className="text-center border-b-2 border-slate-900 pb-4">
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-600 font-sans">
              Pemerintah Kota Bandung
            </h3>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
              {pejabatConfig.kepalaDinas.instansi}
            </h1>
            <h2 className="text-xs font-bold uppercase text-slate-800">
              Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
            </h2>
            <div className="text-xs font-bold underline uppercase tracking-wide mt-3">
              REKAPITULASI PEMANTAUAN KEGIATAN &amp; PEKERJAAN
              {selectedTahunAnggaran !== 'all'
                ? ` — TAHUN ANGGARAN ${selectedTahunAnggaran}`
                : ' — LINTAS TAHUN ANGGARAN'}
            </div>
            <div className="text-[11px] text-slate-700 mt-1.5 space-y-0.5">
              <div>
                Tahun Anggaran:{' '}
                <span className="font-semibold font-mono tabular-nums">
                  {selectedTahunAnggaran === 'all'
                    ? 'Semua Tahun Anggaran'
                    : `TA ${selectedTahunAnggaran}`}
                </span>
                <span aria-hidden="true"> · </span>
                Jenis:{' '}
                <span className="font-semibold">
                  {selectedJenisPaket === 'all' ? 'Semua Jenis' : selectedJenisPaket}
                </span>
              </div>
              <div className="text-slate-600 tabular-nums">
                Dicetak Per: {printedDateText} · Menampilkan:{' '}
                <span className="font-bold text-slate-900">
                  {filteredPaketList.length} Paket
                </span>{' '}
                ({paketStats.selesai} Selesai, {paketStats.sedangBerjalan} Berjalan,{' '}
                {paketStats.terlambat} Terlambat)
              </div>
            </div>
          </div>

          {/* 4-Column Summary Strip (Single Elevation, Border Divided) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/60">
            <div className="p-4">
              <div className="text-[11px] font-semibold text-slate-500">
                Total Paket Terpilih
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {paketStats.totalPaket} Paket
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                {paketStats.belumMulai} belum mulai · {paketStats.sedangBerjalan} berjalan
              </div>
            </div>

            <div className="p-4">
              <div className="text-[11px] font-semibold text-slate-500">
                Total Pagu Anggaran
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                {formatRupiah(paketStats.totalAnggaran)}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 font-mono tabular-nums">
                {selectedTahunAnggaran === 'all'
                  ? 'Akumulasi semua TA'
                  : `Pagu TA ${selectedTahunAnggaran}`}
              </div>
            </div>

            <div className="p-4">
              <div className="text-[11px] font-semibold text-emerald-700">
                Realisasi Pekerjaan Selesai
              </div>
              <div className="text-lg font-bold text-emerald-800 font-mono tabular-nums mt-1">
                {formatRupiah(paketStats.anggaranSelesai)}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 font-mono tabular-nums">
                {realisasiAnggaranPct}% dari pagu ({paketStats.selesai} paket tuntas)
              </div>
            </div>

            <div className="p-4">
              <div className="text-[11px] font-semibold text-slate-500">
                Rata-Rata Progres Tahapan
              </div>
              <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
                {paketStats.rataRataProgres}%
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                {paketStats.terlambat} terlambat · {paketStats.mendekatiTenggat} mendekati selesai
              </div>
            </div>
          </div>

          {/* Comparative Cross-Year Table (when viewing Semua Tahun Anggaran and multiple years or >=1 package exist) */}
          {selectedTahunAnggaran === 'all' && tahunSummaries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Ringkasan Per Tahun Anggaran
                </h4>
                <span className="text-[11px] text-slate-500 print:hidden">
                  Klik baris tahun untuk memfokuskan rekap ke Tahun Anggaran tersebut
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3">Tahun Anggaran</th>
                      <th className="py-2.5 px-3 text-right">Jumlah Paket</th>
                      <th className="py-2.5 px-3 text-right">Tuntas</th>
                      <th className="py-2.5 px-3 text-right">Total Pagu Anggaran</th>
                      <th className="py-2.5 px-3 text-right">Nilai Realisasi Selesai</th>
                      <th className="py-2.5 px-3 text-right">Serapan (%)</th>
                      <th className="py-2.5 px-3 text-right">Rata-Rata Progres</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tahunSummaries.map((row) => (
                      <tr
                        key={row.tahunAnggaran}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                          <button
                            type="button"
                            onClick={() => setSelectedTahunAnggaran(row.tahunAnggaran)}
                            className="text-blue-700 hover:underline font-mono font-bold print:no-underline print:text-slate-900"
                          >
                            TA {row.tahunAnggaran}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                          {row.totalPaket}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {row.selesai}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatRupiah(row.totalAnggaran)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                          {formatRupiah(row.anggaranSelesai)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                          {row.persentaseRealisasiAnggaran}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                          {row.rataRataProgres}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breakdown per Jenis Pelaksanaan */}
          {filteredPaketList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {jenisSummaries.map((item) => (
                <div
                  key={item.jenisPelaksanaan}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                >
                  <div className="font-semibold text-slate-700">{item.jenisPelaksanaan}</div>
                  <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                    {formatRupiah(item.totalAnggaran)}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                    {item.totalPaket} paket · {item.selesai} selesai
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Main Printable Table */}
          {filteredPaketList.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Belum ada paket kegiatan &amp; pekerjaan pada Tahun Anggaran atau filter yang dipilih.
              </p>
              <p className="text-[11px] text-slate-500">
                Tambahkan paket pada menu Kegiatan &amp; Pekerjaan atau pilih Tahun Anggaran lainnya.
              </p>
              {hasActivePaketFilter && (
                <button
                  type="button"
                  onClick={handleResetPaketFilters}
                  className="mt-2 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 print:hidden"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tampilkan Semua Tahun Anggaran</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                    <th className="border border-slate-800 p-2 text-center w-9">No.</th>
                    <th className="border border-slate-800 p-2 text-center w-16">TA</th>
                    <th className="border border-slate-800 p-2">
                      Kegiatan, Sub Kegiatan &amp; Pekerjaan
                    </th>
                    <th className="border border-slate-800 p-2 w-40">Pelaksanaan &amp; PIC</th>
                    <th className="border border-slate-800 p-2 text-right w-36">
                      Pagu Anggaran
                    </th>
                    <th className="border border-slate-800 p-2 w-36">Durasi &amp; Jadwal</th>
                    <th className="border border-slate-800 p-2 min-w-[200px]">
                      Progres &amp; Tahapan
                    </th>
                    <th className="border border-slate-800 p-2 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredPaketList.map((paket, idx) => {
                    const progress = computePaketProgress(paket, todayIso);
                    const tahun = getPaketTahunAnggaran(paket);
                    return (
                      <tr key={paket.id} className="align-top print:break-inside-avoid">
                        <td className="border border-slate-800 p-2 text-center font-mono tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-800 p-2 text-center font-mono font-bold tabular-nums text-slate-900">
                          {tahun}
                        </td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-bold text-slate-900">{paket.namaKegiatan}</div>
                          <div className="text-slate-700 mt-0.5">{paket.subKegiatan}</div>
                          {paket.pekerjaan && (
                            <div className="text-slate-900 font-medium mt-0.5">
                              Pekerjaan: {paket.pekerjaan}
                            </div>
                          )}
                          {paket.kodeRup && (
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              Kode RUP: {paket.kodeRup}
                            </div>
                          )}
                          {paket.nomorKontrak && (
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              No. Kontrak/SPK: {paket.nomorKontrak}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-semibold text-slate-900">
                            {paket.jenisPelaksanaan}
                          </div>
                          {paket.penyedia && (
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              {paket.penyedia}
                            </div>
                          )}
                          {paket.picNama && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              PIC: {paket.picNama}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                          {formatRupiah(paket.nilaiAnggaran)}
                        </td>
                        <td className="border border-slate-800 p-2 font-mono tabular-nums text-[10px] space-y-0.5">
                          <div>Mulai: {paket.tanggalMulai}</div>
                          <div>Durasi: {progress.durasiHariKerja} hari kalender</div>
                          <div className="font-bold text-slate-900">
                            Selesai: {paket.tenggatWaktu}
                          </div>
                          {paket.tanggalSelesai && (
                            <div className="text-emerald-800 font-semibold">
                              Tuntas: {paket.tanggalSelesai}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2 space-y-1">
                          <div className="font-mono font-bold text-slate-900 tabular-nums">
                            {progress.persentase}% ({progress.selesaiCount}/{progress.totalTahapan}{' '}
                            Tahap)
                          </div>
                          {progress.activeStage && (
                            <div className="text-[10px] text-slate-700">
                              Tahap {progress.activeStage.urutan}: {progress.activeStage.nama}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2 text-center font-bold">
                          <span
                            className={
                              progress.overallStatus === 'selesai'
                                ? 'text-emerald-800'
                                : progress.overallStatus === 'terlambat'
                                ? 'text-rose-800'
                                : progress.overallStatus === 'sedang_berjalan'
                                ? 'text-blue-800'
                                : 'text-slate-600'
                            }
                          >
                            {progress.overallStatusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td
                      colSpan={4}
                      className="border border-slate-800 p-2 text-right uppercase"
                    >
                      Total Pagu Anggaran (
                      {selectedTahunAnggaran === 'all'
                        ? 'Semua Tahun Anggaran'
                        : `TA ${selectedTahunAnggaran}`}
                      )
                    </td>
                    <td className="border border-slate-800 p-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatRupiah(paketStats.totalAnggaran)}
                    </td>
                    <td colSpan={3} className="border border-slate-800 p-2 text-[10px] font-mono tabular-nums">
                      Realisasi Selesai: {formatRupiah(paketStats.anggaranSelesai)} (
                      {realisasiAnggaranPct}%)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Tanda Tangan Pengesahan Laporan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-4 pt-4 text-xs font-sans print:break-inside-avoid">
            <div className="text-center">
              <div className="text-slate-500">Mengetahui,</div>
              <div className="font-bold text-slate-900">Kepala Bidang Perumahan</div>
              <div className="h-16"></div>
              <div className="font-bold underline">{pejabatConfig.kepalaBidang.nama}</div>
              <div className="text-[11px] font-mono text-slate-600">
                NIP. {pejabatConfig.kepalaBidang.nip}
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-500">Bandung, {printedDateText}</div>
              <div className="font-bold text-slate-900">
                Ketua Tim Pengawasan dan Pengendalian Perumahan
              </div>
              <div className="h-16"></div>
              <div className="font-bold underline">{pejabatConfig.ketuaTim.nama}</div>
              <div className="text-[11px] font-mono text-slate-600">
                NIP. {pejabatConfig.ketuaTim.nip}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Printable Sheet View: Persuratan & Disposisi */
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 print:border-none print:p-0">
          {/* Kop Resmi Surat Laporan */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-600 font-sans">
              Pemerintah Kota Bandung
            </h3>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
              {pejabatConfig.kepalaDinas.instansi}
            </h1>
            <h2 className="text-xs font-bold uppercase text-slate-800">
              Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
            </h2>
            <div className="text-xs font-bold underline uppercase tracking-wide mt-3">
              DAFTAR SURAT MASUK, DISPOSISI, DAN PEMANTAUAN TINDAK LANJUT
            </div>
            <div className="text-[11px] text-slate-700 mt-1.5 space-y-0.5">
              <div>
                Status: <span className="font-semibold">{getRekapStatusLabel(statusFilter)}</span>
                <span aria-hidden="true"> · </span>
                Tahun:{' '}
                <span className="font-semibold font-mono tabular-nums">
                  {suratTahunFilter === 'all' ? 'Semua Tahun' : suratTahunFilter}
                </span>
                <span aria-hidden="true"> · </span>
                Periode ({getRekapDateBasisLabel(dateBasis)}):{' '}
                <span className="font-semibold">{formatRekapPeriodeLabel(dateFrom, dateTo)}</span>
              </div>
              <div className="text-slate-600 tabular-nums">
                Dicetak Per: {printedDateText} · Menampilkan:{' '}
                <span className="font-bold text-slate-900">
                  {filteredSuratList.length} Surat
                </span>{' '}
                ({filteredAktifSuratCount} Dalam Proses, {filteredSelesaiSuratCount} Selesai Tindak
                Lanjut)
              </div>
            </div>
          </div>

          {/* High-Density Report Table or Empty Filter State */}
          {filteredSuratList.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada data surat yang sesuai dengan filter status, tahun, atau rentang tanggal
                yang dipilih.
              </p>
              <p className="text-[11px] text-slate-500">
                Ubah pilihan filter untuk menampilkan seluruh arsip persuratan.
              </p>
              {hasActiveSuratFilter && (
                <button
                  type="button"
                  onClick={handleResetSuratFilters}
                  className="mt-2 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 print:hidden"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tampilkan Semua Surat</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                    <th className="border border-slate-800 p-2 text-center w-9">No.</th>
                    <th className="border border-slate-800 p-2 w-24">Tanggal</th>
                    <th className="border border-slate-800 p-2 w-40">Asal &amp; Nomor Surat</th>
                    <th className="border border-slate-800 p-2 w-48">Perihal</th>
                    <th className="border border-slate-800 p-2 w-36">Disposisi</th>
                    <th className="border border-slate-800 p-2 min-w-[260px]">
                      {includeHistory
                        ? 'Status & Riwayat Tindak Lanjut Lengkap'
                        : 'Status Tindak Lanjut'}
                    </th>
                    <th className="border border-slate-800 p-2 w-28 text-center">Berkas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSuratList.map((item, idx) => {
                    const tahap = TAHAP_TINDAK_LANJUT[item.tahapSaatIni];
                    const riwayat = item.riwayatTindakLanjut || [];
                    const lastHistory = riwayat.length > 0 ? riwayat[riwayat.length - 1] : null;

                    return (
                      <tr key={item.id} className="align-top print:break-inside-avoid">
                        <td className="border border-slate-800 p-2 text-center font-mono font-medium tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-800 p-2 font-mono tabular-nums space-y-0.5">
                          <div className="font-semibold text-slate-900">{item.tanggalSurat}</div>
                          {item.tanggalDiterima && item.tanggalDiterima !== item.tanggalSurat && (
                            <div className="text-[10px] text-slate-500">
                              Diterima: {item.tanggalDiterima}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-semibold text-slate-900">{item.asalSurat}</div>
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5 break-all">
                            {item.nomorSurat}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Sifat: {item.sifat}
                          </div>
                        </td>
                        <td className="border border-slate-800 p-2 leading-relaxed text-slate-900">
                          {item.perihal}
                        </td>
                        <td className="border border-slate-800 p-2">
                          <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {item.tanggalDisposisi || '-'}
                          </div>
                          {item.tenggatWaktu && (
                            <div className="font-mono text-[10px] font-semibold text-amber-800 tabular-nums">
                              Tenggat: {item.tenggatWaktu}
                            </div>
                          )}
                          <div className="font-semibold text-purple-900 mt-0.5">
                            {item.penerimaDisposisiNama.join(', ') || 'Belum didisposisikan'}
                          </div>
                          {item.instruksiDisposisi && (
                            <div className="text-[10px] text-slate-600 mt-0.5 italic">
                              &ldquo;{item.instruksiDisposisi}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-800 p-2 space-y-1.5">
                          {item.statusSelesai ? (
                            <div className="font-bold text-emerald-800">
                              ✓ Selesai Tindak Lanjut
                              {item.tanggalSelesai ? ` (${item.tanggalSelesai})` : ''}
                            </div>
                          ) : (
                            <div className="font-bold text-slate-900">
                              Tahap {item.tahapSaatIni}: {tahap?.nama}
                            </div>
                          )}

                          {includeHistory ? (
                            riwayat.length > 0 ? (
                              <ol className="space-y-1 pt-1 border-t border-slate-200 list-none">
                                {riwayat.map((h, hIdx) => (
                                  <li
                                    key={h.id || hIdx}
                                    className="text-[10px] leading-snug text-slate-700 pl-2 border-l border-slate-300"
                                  >
                                    <div className="font-semibold text-slate-900">
                                      {hIdx + 1}. Tahap {h.tahapId}: {h.tahapNama}
                                    </div>
                                    <div className="text-[9px] text-slate-500 font-mono tabular-nums">
                                      {h.tanggal || '-'} · {h.aktor}
                                    </div>
                                    <div className="text-slate-700">
                                      {normalizeRiwayatCatatan(h.catatan)}
                                    </div>
                                    {h.fileLampiran?.nama && (
                                      <div className="text-[9px] text-blue-700">
                                        Lampiran: {h.fileLampiran.nama}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">
                                Belum ada catatan riwayat proses.
                              </div>
                            )
                          ) : (
                            lastHistory && (
                              <div className="text-[10px] text-slate-600">
                                • {normalizeRiwayatCatatan(lastHistory.catatan)}
                              </div>
                            )
                          )}
                        </td>
                        <td className="border border-slate-800 p-2 text-center space-y-1">
                          {item.statusSelesai ? (
                            <div className="font-bold text-emerald-800">
                              {item.fileSuratKeluar ? 'Selesai (Surat Keluar Terbit)' : 'Selesai'}
                            </div>
                          ) : (
                            <div className="font-medium text-slate-700">Dalam Proses</div>
                          )}

                          {item.nomorSuratKeluar && (
                            <div className="text-[9px] font-mono text-slate-600 break-all">
                              No. Keluar: {item.nomorSuratKeluar}
                            </div>
                          )}

                          <div className="flex flex-col gap-1 pt-1 print:hidden">
                            {item.fileSuratMasuk && (
                              <button
                                type="button"
                                onClick={() => onOpenPdfViewer(item.fileSuratMasuk!)}
                                className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-medium border border-blue-200"
                              >
                                <FileText className="w-3 h-3" />
                                <span>PDF Masuk</span>
                              </button>
                            )}
                            {item.fileSuratKeluar && (
                              <button
                                type="button"
                                onClick={() => onOpenPdfViewer(item.fileSuratKeluar!)}
                                className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium border border-emerald-200"
                              >
                                <FileCheck className="w-3 h-3" />
                                <span>PDF Keluar</span>
                              </button>
                            )}
                          </div>
                          <div className="hidden print:block text-[9px] text-slate-500">
                            {item.fileSuratMasuk ? 'PDF Masuk: Ada' : 'PDF Masuk: -'}
                            {item.fileSuratKeluar ? ' · PDF Keluar: Ada' : ''}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tanda Tangan Pengesahan Laporan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-4 mt-8 text-xs font-sans print:break-inside-avoid">
            <div className="text-center">
              <div className="text-slate-500">Mengetahui,</div>
              <div className="font-bold text-slate-900">Kepala Bidang Perumahan</div>
              <div className="h-16"></div>
              <div className="font-bold underline">{pejabatConfig.kepalaBidang.nama}</div>
              <div className="text-[11px] font-mono text-slate-600">
                NIP. {pejabatConfig.kepalaBidang.nip}
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-500">Bandung, {printedDateText}</div>
              <div className="font-bold text-slate-900">
                Ketua Tim Pengawasan dan Pengendalian Perumahan
              </div>
              <div className="h-16"></div>
              <div className="font-bold underline">{pejabatConfig.ketuaTim.nama}</div>
              <div className="text-[11px] font-mono text-slate-600">
                NIP. {pejabatConfig.ketuaTim.nip}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
