import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { AgendaEvent, AgendaKategori, AgendaStatus, PejabatConfig, Personel } from '../types';
import {
  AGENDA_KATEGORI_LIST,
  AGENDA_STATUS_LIST,
  AgendaRekapPeriodMode,
  NAMA_BULAN,
  NAMA_HARI_FULL,
  addDaysIso,
  addMonthsIso,
  buildAgendaRekapCsvContent,
  calculateAgendaRekapStats,
  filterAgendaForRekap,
  formatAgendaTimeRange,
  formatIndonesianDateFull,
  formatWeekRangeLabel,
  getAgendaStatusLabel,
  getDayOfWeekMonFirst,
  getKategoriStyle,
  getMonthStartAndEndIso,
  normalizeAgendaStatus,
  pad2,
  parseIsoDateParts,
  resolveAgendaRekapRange,
} from '../utils/agendaLogic';

interface AgendaRekapPanelProps {
  agendaList: AgendaEvent[];
  personelList: Personel[];
  pejabatConfig: PejabatConfig;
  initialAnchorDate: string;
  initialKategori?: AgendaKategori | 'all';
  initialPersonel?: string | 'all';
  initialSearchQuery?: string;
  onOpenCreate: (opts?: { date?: string; jamMulai?: string; jamSelesai?: string }) => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onNotify?: (message: string) => void;
}

function getLocalTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function addMonthsToMonthStr(monthStr: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec((monthStr || '').trim());
  const baseIso = match ? `${match[1]}-${match[2]}-01` : getLocalTodayIso();
  return addMonthsIso(baseIso, delta).slice(0, 7);
}

export const AgendaRekapPanel: React.FC<AgendaRekapPanelProps> = ({
  agendaList,
  personelList,
  pejabatConfig,
  initialAnchorDate,
  initialKategori = 'all',
  initialPersonel = 'all',
  initialSearchQuery = '',
  onOpenCreate,
  onOpenEvent,
  onNotify,
}) => {
  const todayIso = useMemo(() => getLocalTodayIso(), []);
  const defaultMonthBounds = useMemo(
    () => getMonthStartAndEndIso((initialAnchorDate || todayIso).slice(0, 7)),
    [initialAnchorDate, todayIso]
  );

  const [periodMode, setPeriodMode] = useState<AgendaRekapPeriodMode>('bulanan');
  const [anchorDate, setAnchorDate] = useState<string>(initialAnchorDate || todayIso);
  const [monthStr, setMonthStr] = useState<string>((initialAnchorDate || todayIso).slice(0, 7));
  const [dateFrom, setDateFrom] = useState<string>(defaultMonthBounds.startDate);
  const [dateTo, setDateTo] = useState<string>(defaultMonthBounds.endDate);

  const [selectedKategori, setSelectedKategori] = useState<AgendaKategori | 'all'>(initialKategori);
  const [selectedStatus, setSelectedStatus] = useState<AgendaStatus | 'all'>('all');
  const [selectedPersonel, setSelectedPersonel] = useState<string | 'all'>(initialPersonel);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);

  const resolvedRange = useMemo(
    () =>
      resolveAgendaRekapRange({
        mode: periodMode,
        anchorDate,
        monthStr,
        dateFrom,
        dateTo,
      }),
    [periodMode, anchorDate, monthStr, dateFrom, dateTo]
  );

  const filteredEvents = useMemo(
    () =>
      filterAgendaForRekap(agendaList, {
        mode: periodMode,
        anchorDate,
        monthStr,
        dateFrom,
        dateTo,
        kategori: selectedKategori,
        status: selectedStatus,
        personelNama: selectedPersonel,
        searchQuery,
      }),
    [
      agendaList,
      periodMode,
      anchorDate,
      monthStr,
      dateFrom,
      dateTo,
      selectedKategori,
      selectedStatus,
      selectedPersonel,
      searchQuery,
    ]
  );

  const stats = useMemo(() => calculateAgendaRekapStats(filteredEvents), [filteredEvents]);

  const hasSecondaryFilter =
    selectedKategori !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPersonel !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedKategori('all');
    setSelectedStatus('all');
    setSelectedPersonel('all');
    setSearchQuery('');
    if (periodMode === 'range') {
      const bounds = getMonthStartAndEndIso(todayIso.slice(0, 7));
      setDateFrom(bounds.startDate);
      setDateTo(bounds.endDate);
    } else if (periodMode === 'bulanan') {
      setMonthStr(todayIso.slice(0, 7));
    } else {
      setAnchorDate(todayIso);
    }
  };

  const handleExportCsv = () => {
    if (filteredEvents.length === 0 || resolvedRange.hasError) return;
    const csv = buildAgendaRekapCsvContent(filteredEvents, resolvedRange.periodeLabel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Agenda_WASDAL_${periodMode}_${todayIso}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify?.(`File CSV rekap agenda (${filteredEvents.length} kegiatan) berhasil diunduh.`);
  };

  const handlePrint = () => {
    if (filteredEvents.length === 0 || resolvedRange.hasError) return;
    window.print();
  };

  return (
    <div className="space-y-4 p-4 sm:p-5 print:p-0">
      {/* Controls Card (Hidden on print) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Filter Periode &amp; Cetak Rekap</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih mode harian, mingguan, bulanan, atau rentang tanggal tertentu untuk melihat ringkasan, mencetak, atau mengekspor CSV
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredEvents.length === 0 || resolvedRange.hasError}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs border border-slate-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV ({filteredEvents.length})</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredEvents.length === 0 || resolvedRange.hasError}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Rekap ({filteredEvents.length})</span>
            </button>
          </div>
        </div>

        {/* Period Mode Selector & Date Picker Bar */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 xl:grid-cols-12 gap-3 items-end text-xs">
          {/* Mode Buttons */}
          <div className="xl:col-span-5 space-y-1.5">
            <span className="block font-semibold text-slate-700">Jenis Periode Rekap</span>
            <div
              role="group"
              aria-label="Jenis periode rekap agenda"
              className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 border border-slate-200 w-full sm:w-auto"
            >
              {(
                [
                  { id: 'harian', label: 'Harian' },
                  { id: 'mingguan', label: 'Mingguan' },
                  { id: 'bulanan', label: 'Bulanan' },
                  { id: 'range', label: 'Range Tanggal' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`rekap-mode-${m.id}`}
                  aria-pressed={periodMode === m.id}
                  onClick={() => setPeriodMode(m.id)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap text-center ${
                    periodMode === m.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Context-aware Period Inputs */}
          <div className="xl:col-span-7">
            {periodMode === 'harian' && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <label htmlFor="rekap-agenda-harian" className="font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pilih Tanggal Harian</span>
                  </label>
                  <input
                    id="rekap-agenda-harian"
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAnchorDate(addDaysIso(anchorDate, -1))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Hari sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchorDate(todayIso)}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchorDate(addDaysIso(anchorDate, 1))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Hari berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {periodMode === 'mingguan' && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <label htmlFor="rekap-agenda-mingguan" className="font-semibold text-slate-700 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pilih Tanggal dalam Minggu</span>
                  </label>
                  <input
                    id="rekap-agenda-mingguan"
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAnchorDate(addDaysIso(anchorDate, -7))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Minggu sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold tabular-nums whitespace-nowrap">
                    {formatWeekRangeLabel(anchorDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnchorDate(addDaysIso(anchorDate, 7))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Minggu berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {periodMode === 'bulanan' && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <label htmlFor="rekap-agenda-bulanan" className="font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pilih Bulan &amp; Tahun</span>
                  </label>
                  <input
                    id="rekap-agenda-bulanan"
                    type="month"
                    value={monthStr}
                    onChange={(e) => setMonthStr(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMonthStr((prev) => addMonthsToMonthStr(prev, -1))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthStr(todayIso.slice(0, 7))}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthStr((prev) => addMonthsToMonthStr(prev, 1))}
                    className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {periodMode === 'range' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="rekap-agenda-from" className="font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Dari Tanggal</span>
                  </label>
                  <input
                    id="rekap-agenda-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="rekap-agenda-to" className="font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sampai Tanggal</span>
                  </label>
                  <input
                    id="rekap-agenda-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Filters Row */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end text-xs">
          <div className="lg:col-span-3 space-y-1">
            <label htmlFor="rekap-agenda-kategori" className="block font-semibold text-slate-700">
              Kategori Kegiatan
            </label>
            <select
              id="rekap-agenda-kategori"
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value as AgendaKategori | 'all')}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            >
              <option value="all">Semua Kategori</option>
              {AGENDA_KATEGORI_LIST.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 space-y-1">
            <label htmlFor="rekap-agenda-status" className="block font-semibold text-slate-700">
              Status Agenda
            </label>
            <select
              id="rekap-agenda-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as AgendaStatus | 'all')}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            >
              <option value="all">Semua Status</option>
              {AGENDA_STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {getAgendaStatusLabel(st)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 space-y-1">
            <label htmlFor="rekap-agenda-personel" className="block font-semibold text-slate-700">
              Personel Peserta
            </label>
            <select
              id="rekap-agenda-personel"
              value={selectedPersonel}
              onChange={(e) => setSelectedPersonel(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            >
              <option value="all">Semua Personel</option>
              {personelList.map((p) => (
                <option key={p.id} value={p.nama}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 space-y-1">
            <label htmlFor="rekap-agenda-search" className="block font-semibold text-slate-700">
              Pencarian Kata Kunci
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="rekap-agenda-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Judul, lokasi, catatan..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              title="Reset filter rekap"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>

        {resolvedRange.hasError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{resolvedRange.errorMessage}</span>
          </div>
        )}
      </div>

      {/* Summary KPI Strip (Screen only for quick insight) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">Total Agenda Periode</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
            {stats.totalAgenda}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
            {stats.totalAktif} aktif · {stats.totalDijadwalkanUlang} jadwal ulang · {stats.totalDibatalkan} batal
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500">Hari Aktif Kegiatan</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
            {stats.hariAktif} <span className="text-xs font-medium text-slate-500">hari</span>
          </div>
          <div className="text-[11px] text-slate-500 truncate mt-0.5">
            {resolvedRange.periodeLabel}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Sebaran Kategori</div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] tabular-nums">
            {AGENDA_KATEGORI_LIST.map((kat) => {
              const count = stats.byKategori[kat] || 0;
              const st = getKategoriStyle(kat);
              return (
                <span key={kat} className="inline-flex items-center gap-1 text-slate-700">
                  <span className={`w-2 h-2 rounded-xs ${st.dot}`} />
                  <span className="truncate max-w-[92px]">{kat.split(' ')[0]}:</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Keikutsertaan Personel</div>
          {stats.personelBreakdown.length === 0 ? (
            <div className="text-xs text-slate-400">Belum ada personel tercatat</div>
          ) : (
            <div className="space-y-0.5 text-[11px] tabular-nums">
              {stats.personelBreakdown.slice(0, 3).map((item) => (
                <div key={item.nama} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{item.nama}</span>
                  <span className="font-bold text-slate-900 shrink-0">{item.jumlah}×</span>
                </div>
              ))}
              {stats.personelBreakdown.length > 3 && (
                <div className="text-[10px] text-slate-500">
                  +{stats.personelBreakdown.length - 3} personel lainnya
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Official Report Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-8 print:border-none print:shadow-none print:p-0">
        {/* Institutional Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
          <h4 className="text-xs uppercase font-bold tracking-widest text-slate-600">
            Pemerintah Kota Bandung
          </h4>
          <div className="text-base font-extrabold uppercase tracking-wide text-slate-900 mt-0.5">
            {pejabatConfig.kepalaDinas.instansi}
          </div>
          <div className="text-xs font-bold uppercase text-slate-800">
            Bidang Perumahan · Tim Pengawasan dan Pengendalian Perumahan
          </div>
          <div className="text-xs font-bold underline uppercase tracking-wide mt-3">
            REKAPITULASI AGENDA KEGIATAN TIM WASDAL
          </div>
          <div className="text-[11px] text-slate-700 mt-1.5 space-y-0.5">
            <div>
              Periode: <span className="font-semibold text-slate-900">{resolvedRange.periodeLabel}</span>
              <span aria-hidden="true"> · </span>
              Kategori:{' '}
              <span className="font-semibold">
                {selectedKategori === 'all' ? 'Semua Kategori' : selectedKategori}
              </span>
              <span aria-hidden="true"> · </span>
              Personel:{' '}
              <span className="font-semibold">
                {selectedPersonel === 'all' ? 'Semua Personel' : selectedPersonel}
              </span>
            </div>
            <div className="text-slate-600 tabular-nums">
              Dicetak Per:{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · Total: <span className="font-bold text-slate-900">{filteredEvents.length} Agenda</span> ({stats.hariAktif} Hari Aktif)
            </div>
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredEvents.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              {resolvedRange.hasError
                ? 'Perbaiki rentang tanggal di atas untuk menampilkan rekap agenda.'
                : 'Belum ada agenda kegiatan pada periode dan filter yang dipilih.'}
            </p>
            <p className="text-[11px] text-slate-500">
              Ubah pilihan periode ({resolvedRange.periodeLabel}) atau tambahkan agenda baru untuk periode ini.
            </p>
            {!resolvedRange.hasError && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 print:hidden">
                <button
                  type="button"
                  onClick={() =>
                    onOpenCreate({
                      date: resolvedRange.startDate || anchorDate,
                      jamMulai: '09:00',
                      jamSelesai: '10:00',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Agenda di Periode Ini</span>
                </button>
                {hasSecondaryFilter && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-800 text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold text-slate-900 uppercase">
                  <th className="border border-slate-800 p-2 text-center w-9">No.</th>
                  <th className="border border-slate-800 p-2 w-32">Hari &amp; Tanggal</th>
                  <th className="border border-slate-800 p-2 w-28">Waktu</th>
                  <th className="border border-slate-800 p-2 w-32">Status</th>
                  <th className="border border-slate-800 p-2 w-36">Kategori</th>
                  <th className="border border-slate-800 p-2 min-w-[200px]">Agenda Kegiatan &amp; Catatan</th>
                  <th className="border border-slate-800 p-2 w-40">Lokasi</th>
                  <th className="border border-slate-800 p-2 min-w-[180px]">Personel &amp; Peserta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEvents.map((ev, idx) => {
                  const parts = parseIsoDateParts(ev.tanggal);
                  const dow = getDayOfWeekMonFirst(ev.tanggal);
                  const st = getKategoriStyle(ev.kategori);
                  const evStatus = normalizeAgendaStatus(ev.status);

                  return (
                    <tr
                      key={ev.id}
                      className={`align-top print:break-inside-avoid ${
                        evStatus === 'dibatalkan'
                          ? 'bg-slate-50/80 text-slate-500'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="border border-slate-800 p-2 text-center font-mono font-medium tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-800 p-2 tabular-nums">
                        <div className="font-semibold text-slate-900">{NAMA_HARI_FULL[dow]}</div>
                        <div className="text-[10px] font-mono text-slate-600">
                          {parts.day} {NAMA_BULAN[parts.monthIndex]} {parts.year}
                        </div>
                      </td>
                      <td className="border border-slate-800 p-2 font-mono font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                        {formatAgendaTimeRange(ev)}
                      </td>
                      <td className="border border-slate-800 p-2 whitespace-nowrap">
                        <span
                          className={`font-bold text-[10px] ${
                            evStatus === 'dibatalkan'
                              ? 'text-rose-700'
                              : evStatus === 'dijadwalkan_ulang'
                              ? 'text-amber-800'
                              : 'text-emerald-700'
                          }`}
                        >
                          {getAgendaStatusLabel(ev.status)}
                        </span>
                        {evStatus === 'dijadwalkan_ulang' && ev.tanggalSebelumnya && (
                          <div className="text-[9px] text-slate-500 mt-0.5 tabular-nums">
                            Dari: {formatIndonesianDateFull(ev.tanggalSebelumnya)}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-800 p-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-semibold print:border-slate-400 print:bg-transparent print:text-slate-900 whitespace-nowrap ${st.bg} ${st.border} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-xs shrink-0 print:hidden ${st.dot}`} />
                          {ev.kategori}
                        </span>
                      </td>
                      <td className="border border-slate-800 p-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => onOpenEvent(ev)}
                          className={`text-left font-bold hover:text-blue-700 hover:underline print:no-underline print:text-slate-900 ${
                            evStatus === 'dibatalkan'
                              ? 'line-through text-slate-500'
                              : 'text-slate-900'
                          }`}
                        >
                          {ev.judul}
                        </button>
                        {ev.alasanStatus && (
                          <div className="text-[10px] text-slate-700">
                            Keterangan status: {ev.alasanStatus}
                          </div>
                        )}
                        {ev.catatan && (
                          <div className="text-[10px] text-slate-600 leading-relaxed">
                            {ev.catatan}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400 print:hidden">
                          Dibuat oleh: {ev.dibuatOlehNama}
                        </div>
                      </td>
                      <td className="border border-slate-800 p-2 text-slate-800">
                        <span className="inline-flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 print:hidden" />
                          <span>{ev.lokasi}</span>
                        </span>
                      </td>
                      <td className="border border-slate-800 p-2 space-y-1">
                        <div className="inline-flex items-start gap-1 text-slate-900 font-medium">
                          <Users className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 print:hidden" />
                          <span>
                            {ev.pesertaNama.length > 0
                              ? ev.pesertaNama.join(', ')
                              : 'Tidak ada personel internal'}
                          </span>
                        </div>
                        {ev.pesertaTambahan && (
                          <div className="text-[10px] text-slate-600">
                            Tambahan: {ev.pesertaTambahan}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-4 mt-8 text-xs print:break-inside-avoid">
          <div className="text-center">
            <div className="text-slate-500">Mengetahui,</div>
            <div className="font-bold text-slate-900">Kepala Bidang Perumahan</div>
            <div className="h-16" />
            <div className="font-bold underline">{pejabatConfig.kepalaBidang.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">
              NIP. {pejabatConfig.kepalaBidang.nip}
            </div>
          </div>

          <div className="text-center">
            <div className="text-slate-500">
              Bandung,{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="font-bold text-slate-900">
              Ketua Tim Pengawasan dan Pengendalian Perumahan
            </div>
            <div className="h-16" />
            <div className="font-bold underline">{pejabatConfig.ketuaTim.nama}</div>
            <div className="text-[11px] font-mono text-slate-600">
              NIP. {pejabatConfig.ketuaTim.nip}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
