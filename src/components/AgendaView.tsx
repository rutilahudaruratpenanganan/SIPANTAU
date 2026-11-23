import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Filter,
  List,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AgendaEvent, AgendaKategori, AgendaStatus, PejabatConfig, Personel } from '../types';
import { AgendaRekapPanel } from './AgendaRekapPanel';
import {
  AGENDA_KATEGORI_LIST,
  AGENDA_STATUS_LIST,
  NAMA_BULAN,
  NAMA_HARI_FULL,
  NAMA_HARI_SHORT,
  addDaysIso,
  addMonthsIso,
  computeTimeBlockPosition,
  filterAgendaEvents,
  formatAgendaTimeRange,
  formatIndonesianDateFull,
  formatIsoDateFromParts,
  formatMonthYearLabel,
  formatWeekRangeLabel,
  getAgendaStatusLabel,
  getDayOfWeekMonFirst,
  getKategoriStyle,
  getMonthCalendarGrid,
  getUpcomingAgendaEvents,
  getWeekDays,
  minutesToHhmm,
  normalizeAgendaStatus,
  pad2,
  parseIsoDateParts,
  timeToMinutes,
} from '../utils/agendaLogic';

export type CalendarViewMode = 'bulan' | 'minggu' | 'hari' | 'jadwal' | 'rekap';

interface AgendaViewProps {
  agendaList: AgendaEvent[];
  personelList: Personel[];
  pejabatConfig: PejabatConfig;
  currentUser: Personel;
  onOpenCreate: (opts?: { date?: string; jamMulai?: string; jamSelesai?: string }) => void;
  onOpenEvent: (event: AgendaEvent) => void;
  onNotify?: (message: string) => void;
}

const GRID_HOURS = Array.from({ length: 13 }, (_, i) => 7 + i); // 07:00 .. 19:00

function getLocalTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

interface PositionedAgenda {
  event: AgendaEvent;
  topPct: number;
  heightPct: number;
  colIndex: number;
  colCount: number;
}

function layoutOverlappingDayEvents(dayEvents: AgendaEvent[]): PositionedAgenda[] {
  const timed = [...dayEvents]
    .filter((ev) => !ev.sepanjangHari)
    .sort((a, b) => timeToMinutes(a.jamMulai) - timeToMinutes(b.jamMulai));

  const items = timed.map((event) => {
    const pos = computeTimeBlockPosition(event.jamMulai, event.jamSelesai, 7, 20);
    return {
      event,
      startMin: timeToMinutes(event.jamMulai),
      endMin: Math.max(timeToMinutes(event.jamMulai) + 30, timeToMinutes(event.jamSelesai)),
      topPct: pos.topPct,
      heightPct: pos.heightPct,
      colIndex: 0,
      colCount: 1,
    };
  });

  // Simple greedy column packing within overlapping clusters
  for (let i = 0; i < items.length; i++) {
    const overlapping = items.filter(
      (other) => other.startMin < items[i].endMin && other.endMin > items[i].startMin
    );
    const usedCols = new Set<number>();
    for (const o of overlapping) {
      if (o !== items[i] && items.indexOf(o) < i) {
        usedCols.add(o.colIndex);
      }
    }
    let col = 0;
    while (usedCols.has(col)) col++;
    items[i].colIndex = col;
  }

  for (let i = 0; i < items.length; i++) {
    const overlapping = items.filter(
      (other) => other.startMin < items[i].endMin && other.endMin > items[i].startMin
    );
    const maxCol = Math.max(...overlapping.map((o) => o.colIndex)) + 1;
    items[i].colCount = maxCol;
  }

  return items;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  agendaList,
  personelList,
  pejabatConfig,
  currentUser,
  onOpenCreate,
  onOpenEvent,
  onNotify,
}) => {
  const todayIso = useMemo(() => getLocalTodayIso(), []);
  const [anchorIso, setAnchorIso] = useState<string>(todayIso);
  const [miniMonthIso, setMiniMonthIso] = useState<string>(todayIso);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('bulan');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonel, setSelectedPersonel] = useState<string | 'all'>('all');
  const [selectedKategori, setSelectedKategori] = useState<AgendaKategori | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AgendaStatus | 'all'>('all');

  const filteredEvents = useMemo(
    () =>
      filterAgendaEvents(agendaList, {
        searchQuery,
        personelNama: selectedPersonel,
        kategori: selectedKategori,
        status: selectedStatus,
      }),
    [agendaList, searchQuery, selectedPersonel, selectedKategori, selectedStatus]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.tanggal) || [];
      list.push(ev);
      map.set(ev.tanggal, list);
    }
    return map;
  }, [filteredEvents]);

  const upcomingEvents = useMemo(
    () => getUpcomingAgendaEvents(filteredEvents, todayIso, 4),
    [filteredEvents, todayIso]
  );

  const anchorParts = parseIsoDateParts(anchorIso);
  const miniParts = parseIsoDateParts(miniMonthIso);

  const monthCells = useMemo(
    () => getMonthCalendarGrid(anchorParts.year, anchorParts.monthIndex, todayIso),
    [anchorParts.year, anchorParts.monthIndex, todayIso]
  );

  const miniCells = useMemo(
    () => getMonthCalendarGrid(miniParts.year, miniParts.monthIndex, todayIso),
    [miniParts.year, miniParts.monthIndex, todayIso]
  );

  const weekDays = useMemo(() => getWeekDays(anchorIso), [anchorIso]);

  const handleNavigate = (direction: -1 | 1) => {
    let next = anchorIso;
    if (viewMode === 'bulan' || viewMode === 'jadwal') {
      next = addMonthsIso(anchorIso, direction);
    } else if (viewMode === 'minggu') {
      next = addDaysIso(anchorIso, direction * 7);
    } else {
      next = addDaysIso(anchorIso, direction);
    }
    setAnchorIso(next);
    setMiniMonthIso(next);
  };

  const handleJumpToday = () => {
    setAnchorIso(todayIso);
    setMiniMonthIso(todayIso);
  };

  const handleSelectMiniDate = (isoDate: string) => {
    setAnchorIso(isoDate);
    setMiniMonthIso(isoDate);
  };

  const periodHeading = useMemo(() => {
    if (viewMode === 'bulan') return formatMonthYearLabel(anchorIso);
    if (viewMode === 'minggu') return formatWeekRangeLabel(anchorIso);
    if (viewMode === 'hari') return formatIndonesianDateFull(anchorIso);
    if (viewMode === 'rekap') return 'Rekapitulasi Agenda Kegiatan';
    return 'Daftar Agenda Kegiatan';
  }, [viewMode, anchorIso]);

  const activeFiltersCount =
    (searchQuery.trim() ? 1 : 0) +
    (selectedPersonel !== 'all' ? 1 : 0) +
    (selectedKategori !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0);

  const groupedJadwalDates = useMemo(() => {
    const groups: { tanggal: string; items: AgendaEvent[] }[] = [];
    for (const ev of filteredEvents) {
      const existing = groups.find((g) => g.tanggal === ev.tanggal);
      if (existing) {
        existing.items.push(ev);
      } else {
        groups.push({ tanggal: ev.tanggal, items: [ev] });
      }
    }
    return groups;
  }, [filteredEvents]);

  const renderAttendeeSummary = (ev: AgendaEvent) => {
    const total = ev.pesertaNama.length;
    if (total === 0) return ev.pesertaTambahan || '-';
    if (total === 1) return ev.pesertaNama[0];
    return `${ev.pesertaNama[0]} +${total - 1} lainnya`;
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Kalender &amp; Agenda Kegiatan Tim Wasdal
          </h2>
          <p className="text-xs text-slate-500">
            Jadwalkan agenda rapat, asistensi, audiensi, dan tinjauan lapangan lengkap dengan waktu, lokasi, personel peserta, serta rekap agenda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-medium tabular-nums whitespace-nowrap">
            Total Agenda: <span className="font-bold text-slate-900">{agendaList.length}</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === 'rekap' ? 'bulan' : 'rekap'))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
              viewMode === 'rekap'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{viewMode === 'rekap' ? 'Kembali ke Kalender' : 'Rekap Agenda'}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCreate({ date: anchorIso, jamMulai: '09:00', jamSelesai: '10:00' })}
            className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Agenda</span>
          </button>
        </div>
      </div>

      {/* Google Calendar-Style Workspace */}
      <div className="flex flex-col-reverse lg:flex-row gap-4 items-start print:block">
        {/* Left Sidebar (hidden in Rekap mode & print for full-width report) */}
        {viewMode !== 'rekap' && (
          <aside className="w-full lg:w-72 shrink-0 space-y-4 print:hidden">
          {/* Primary Create Button */}
          <button
            type="button"
            onClick={() => onOpenCreate({ date: anchorIso, jamMulai: '09:00', jamSelesai: '10:00' })}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Agenda Baru</span>
          </button>

          {/* Mini Month Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-900">
                {formatMonthYearLabel(miniMonthIso)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMiniMonthIso(addMonthsIso(miniMonthIso, -1))}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Bulan sebelumnya di mini kalender"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMiniMonthIso(addMonthsIso(miniMonthIso, 1))}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Bulan berikutnya di mini kalender"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((h) => (
                <div key={h} className="text-[10px] font-bold text-slate-400 py-1">
                  {h}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {miniCells.map((cell) => {
                const hasEvents = (eventsByDate.get(cell.isoDate)?.length || 0) > 0;
                const isSelected = cell.isoDate === anchorIso;
                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    aria-label={`Pilih tanggal ${cell.isoDate}`}
                    onClick={() => handleSelectMiniDate(cell.isoDate)}
                    className={`relative h-8 rounded-lg text-[11px] tabular-nums flex flex-col items-center justify-center transition-colors ${
                      cell.isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : isSelected
                        ? 'bg-blue-50 text-blue-900 font-bold ring-1 ring-inset ring-blue-300'
                        : cell.isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100 font-medium'
                        : 'text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cell.dayNumber}</span>
                    {hasEvents && (
                      <span
                        className={`w-1 h-1 rounded-full mt-0.5 ${
                          cell.isToday ? 'bg-white' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Personel & Kategori */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Filter Kalender</span>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPersonel('all');
                    setSelectedKategori('all');
                    setSelectedStatus('all');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Personel Filter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="filter-agenda-personel" className="font-semibold text-slate-600 text-[11px]">
                  Personel Peserta
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPersonel((prev) =>
                      prev === currentUser.nama ? 'all' : currentUser.nama
                    )
                  }
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition-colors whitespace-nowrap ${
                    selectedPersonel === currentUser.nama
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Agenda Saya
                </button>
              </div>
              <select
                id="filter-agenda-personel"
                value={selectedPersonel}
                onChange={(e) => setSelectedPersonel(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:bg-white focus:border-blue-500"
              >
                <option value="all">Semua Personel</option>
                {personelList.map((p) => (
                  <option key={p.id} value={p.nama}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Kategori Filter */}
            <div className="space-y-1">
              <span className="block font-semibold text-slate-600 text-[11px] mb-1">
                Kategori Agenda
              </span>
              <button
                type="button"
                onClick={() => setSelectedKategori('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  selectedKategori === 'all'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Semua Kategori</span>
                <span className="tabular-nums text-[11px] opacity-80">{agendaList.length}</span>
              </button>
              {AGENDA_KATEGORI_LIST.map((kat) => {
                const st = getKategoriStyle(kat);
                const count = agendaList.filter((a) => a.kategori === kat).length;
                const active = selectedKategori === kat;
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setSelectedKategori(active ? 'all' : kat)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      active
                        ? `${st.bg} ${st.text} font-semibold border ${st.border}`
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${st.dot}`} />
                      <span className="truncate">{kat}</span>
                    </span>
                    <span className="tabular-nums text-[11px] text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label htmlFor="filter-agenda-status" className="block font-semibold text-slate-600 text-[11px]">
                Status Pelaksanaan
              </label>
              <select
                id="filter-agenda-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as AgendaStatus | 'all')}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:bg-white focus:border-blue-500"
              >
                <option value="all">Semua Status</option>
                {AGENDA_STATUS_LIST.map((st) => (
                  <option key={st} value={st}>
                    {getAgendaStatusLabel(st)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Agenda Mendatang */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Agenda Mendatang</span>
              <button
                type="button"
                onClick={() => setViewMode('jadwal')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
              >
                Lihat Semua
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-2">
                Belum ada agenda terjadwal mulai hari ini. Klik tanggal di kalender untuk menambahkan agenda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {upcomingEvents.map((ev) => {
                  const st = getKategoriStyle(ev.kategori);
                  const parts = parseIsoDateParts(ev.tanggal);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onOpenEvent(ev)}
                      className="w-full text-left p-2 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-xs ${st.dot}`} />
                          {ev.kategori}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          {parts.day} {NAMA_BULAN[parts.monthIndex].slice(0, 3)}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 truncate">{ev.judul}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 truncate">
                        <span className="tabular-nums whitespace-nowrap">
                          {formatAgendaTimeRange(ev)}
                        </span>
                        <span>·</span>
                        <span className="truncate">{ev.lokasi}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
        )}

        {/* Main Calendar Container */}
        <section className="flex-1 min-w-0 w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col print:border-none print:shadow-none print:rounded-none print:overflow-visible">
          {/* Calendar Toolbar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col xl:flex-row xl:items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'rekap' ? (
                <button
                  type="button"
                  onClick={() => onOpenCreate({ date: anchorIso, jamMulai: '09:00', jamSelesai: '10:00' })}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Agenda Baru</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Hari Ini
                  </button>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleNavigate(-1)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      aria-label="Periode sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate(1)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors border-l border-slate-200"
                      aria-label="Periode berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              <h3 className="text-sm sm:text-base font-bold text-slate-900 ml-1">
                {periodHeading}
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {viewMode !== 'rekap' && (
                /* Search Box */
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari agenda, lokasi, peserta..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label="Bersihkan pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* View Mode Switcher */}
              <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 self-start sm:self-auto">
                {(
                  [
                    { id: 'bulan', label: 'Bulan' },
                    { id: 'minggu', label: 'Minggu' },
                    { id: 'hari', label: 'Hari' },
                    { id: 'jadwal', label: 'Jadwal' },
                    { id: 'rekap', label: 'Rekap' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    data-testid={`view-mode-${mode.id}`}
                    aria-pressed={viewMode === mode.id}
                    onClick={() => setViewMode(mode.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                      viewMode === mode.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* VIEW 1: BULAN (MONTH GRID) */}
          {viewMode === 'bulan' && (
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90">
                  {NAMA_HARI_FULL.map((hari, idx) => (
                    <div
                      key={hari}
                      className={`px-2 py-2 text-[11px] font-bold text-center border-r last:border-r-0 border-slate-200 whitespace-nowrap ${
                        idx >= 5 ? 'text-slate-500' : 'text-slate-700'
                      }`}
                    >
                      {hari}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {monthCells.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.isoDate) || [];
                    const visibleEvents = dayEvents.slice(0, 3);
                    const overflowCount = Math.max(0, dayEvents.length - visibleEvents.length);
                    const isSelected = cell.isoDate === anchorIso;

                    return (
                      <div
                        key={cell.isoDate}
                        data-testid={`calendar-day-${cell.isoDate}`}
                        onClick={() =>
                          onOpenCreate({
                            date: cell.isoDate,
                            jamMulai: '09:00',
                            jamSelesai: '10:00',
                          })
                        }
                        className={`group min-h-[112px] sm:min-h-[126px] p-1.5 border-b border-r border-slate-200 transition-colors cursor-pointer flex flex-col ${
                          cell.isCurrentMonth
                            ? 'bg-white hover:bg-blue-50/30'
                            : 'bg-slate-50/70 hover:bg-slate-100/70'
                        } ${isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-md text-xs tabular-nums ${
                              cell.isToday
                                ? 'bg-blue-600 text-white font-bold'
                                : cell.isCurrentMonth
                                ? 'text-slate-800 font-semibold'
                                : 'text-slate-400 font-medium'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCreate({
                                date: cell.isoDate,
                                jamMulai: '09:00',
                                jamSelesai: '10:00',
                              });
                            }}
                            title={`Tambah agenda pada ${cell.isoDate}`}
                            aria-label={`Tambah agenda pada ${cell.isoDate}`}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-blue-100 text-blue-600 transition-opacity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          {visibleEvents.map((ev) => {
                            const st = getKategoriStyle(ev.kategori);
                            const evStatus = normalizeAgendaStatus(ev.status);
                            const isCancelled = evStatus === 'dibatalkan';
                            const isRescheduled = evStatus === 'dijadwalkan_ulang';
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                data-testid={`agenda-event-${ev.id}`}
                                data-status={evStatus}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenEvent(ev);
                                }}
                                className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] leading-tight transition-colors ${
                                  isCancelled
                                    ? 'bg-slate-100 hover:bg-slate-200/70 border-slate-300 text-slate-500'
                                    : `${st.bg} ${st.bgHover} ${st.border} ${st.text}`
                                }`}
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                                      isCancelled ? 'bg-slate-400' : st.dot
                                    }`}
                                  />
                                  <span className="font-mono text-[10px] font-semibold tabular-nums shrink-0">
                                    {ev.sepanjangHari ? 'Sehari' : ev.jamMulai}
                                  </span>
                                  <span
                                    className={`font-semibold truncate ${
                                      isCancelled ? 'line-through' : ''
                                    }`}
                                  >
                                    {ev.judul}
                                  </span>
                                </div>
                                {(isCancelled || isRescheduled) && (
                                  <div
                                    className={`text-[9px] font-bold truncate mt-0.5 ${
                                      isCancelled ? 'text-rose-700' : 'text-amber-800'
                                    }`}
                                  >
                                    {isCancelled ? 'Dibatalkan' : 'Dijadwalkan Ulang'}
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {overflowCount > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAnchorIso(cell.isoDate);
                                setMiniMonthIso(cell.isoDate);
                                setViewMode('hari');
                              }}
                              className="w-full text-left px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:underline whitespace-nowrap"
                            >
                              +{overflowCount} agenda lainnya
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: MINGGU (WEEK TIME GRID) */}
          {viewMode === 'minggu' && (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                {/* Day Header Row */}
                <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/90">
                  <div className="px-2 py-2.5 text-[10px] font-bold text-slate-400 text-right border-r border-slate-200">
                    WIB
                  </div>
                  {weekDays.map((dayIso) => {
                    const parts = parseIsoDateParts(dayIso);
                    const dow = getDayOfWeekMonFirst(dayIso);
                    const isToday = dayIso === todayIso;
                    return (
                      <button
                        key={dayIso}
                        type="button"
                        onClick={() => {
                          setAnchorIso(dayIso);
                          setViewMode('hari');
                        }}
                        className="px-2 py-2 text-center border-r last:border-r-0 border-slate-200 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="text-[10px] font-bold text-slate-500 uppercase">
                          {NAMA_HARI_SHORT[dow]}
                        </div>
                        <div
                          className={`inline-flex items-center justify-center w-7 h-7 mt-0.5 rounded-lg text-xs tabular-nums ${
                            isToday
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-900 font-bold'
                          }`}
                        >
                          {parts.day}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* All-day Strip */}
                {weekDays.some((d) => (eventsByDate.get(d) || []).some((e) => e.sepanjangHari)) && (
                  <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/40">
                    <div className="px-2 py-2 text-[10px] font-semibold text-slate-500 text-right border-r border-slate-200">
                      Sehari
                    </div>
                    {weekDays.map((dayIso) => {
                      const allDay = (eventsByDate.get(dayIso) || []).filter((e) => e.sepanjangHari);
                      return (
                        <div key={dayIso} className="p-1 border-r last:border-r-0 border-slate-200 space-y-1">
                          {allDay.map((ev) => {
                            const st = getKategoriStyle(ev.kategori);
                            const evStatus = normalizeAgendaStatus(ev.status);
                            const isCancelled = evStatus === 'dibatalkan';
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => onOpenEvent(ev)}
                                className={`w-full text-left px-1.5 py-1 rounded border text-[10px] font-semibold truncate ${
                                  isCancelled
                                    ? 'bg-slate-100 border-slate-300 text-slate-500 line-through'
                                    : `${st.bg} ${st.border} ${st.text}`
                                }`}
                              >
                                {isCancelled ? `[Batal] ${ev.judul}` : ev.judul}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hourly Grid */}
                <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] relative">
                  {/* Time Labels Column */}
                  <div className="border-r border-slate-200 bg-slate-50/50">
                    {GRID_HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-14 pr-2 pt-1 text-right text-[10px] font-mono text-slate-400 tabular-nums border-b border-slate-100"
                      >
                        {pad2(hour)}:00
                      </div>
                    ))}
                  </div>

                  {/* 7 Day Columns */}
                  {weekDays.map((dayIso) => {
                    const dayEvents = eventsByDate.get(dayIso) || [];
                    const positioned = layoutOverlappingDayEvents(dayEvents);

                    return (
                      <div
                        key={dayIso}
                        className="relative border-r last:border-r-0 border-slate-200 bg-white"
                      >
                        {GRID_HOURS.map((hour) => (
                          <div
                            key={hour}
                            onClick={() =>
                              onOpenCreate({
                                date: dayIso,
                                jamMulai: `${pad2(hour)}:00`,
                                jamSelesai: minutesToHhmm((hour + 1) * 60),
                              })
                            }
                            title={`Tambah agenda ${dayIso} pukul ${pad2(hour)}:00`}
                            className="h-14 border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          />
                        ))}

                        {positioned.map((item) => {
                          const st = getKategoriStyle(item.event.kategori);
                          const evStatus = normalizeAgendaStatus(item.event.status);
                          const isCancelled = evStatus === 'dibatalkan';
                          const isRescheduled = evStatus === 'dijadwalkan_ulang';
                          const widthPct = 100 / item.colCount;
                          const leftPct = item.colIndex * widthPct;
                          return (
                            <button
                              key={item.event.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEvent(item.event);
                              }}
                              style={{
                                top: `${item.topPct}%`,
                                height: `${item.heightPct}%`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${widthPct}% - 4px)`,
                              }}
                              className={`absolute z-10 rounded-lg border px-1.5 py-1 text-left overflow-hidden shadow-2xs transition-colors ${
                                isCancelled
                                  ? 'bg-slate-100 hover:bg-slate-200/70 border-slate-300 text-slate-500'
                                  : `${st.bg} ${st.bgHover} ${st.border} ${st.text}`
                              }`}
                            >
                              <div className="text-[10px] font-mono font-bold tabular-nums truncate">
                                {item.event.jamMulai}–{item.event.jamSelesai}
                                {isCancelled && (
                                  <span className="ml-1 font-sans text-rose-700">· Batal</span>
                                )}
                                {isRescheduled && (
                                  <span className="ml-1 font-sans text-amber-800">· Ulang</span>
                                )}
                              </div>
                              <div
                                className={`text-[11px] font-bold leading-tight truncate ${
                                  isCancelled ? 'line-through' : ''
                                }`}
                              >
                                {item.event.judul}
                              </div>
                              <div className="text-[10px] opacity-80 truncate">
                                {item.event.lokasi}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: HARI (SINGLE DAY TIME GRID) */}
          {viewMode === 'hari' && (
            <div>
              {/* All-day Strip */}
              {(eventsByDate.get(anchorIso) || []).some((e) => e.sepanjangHari) && (
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                    Sepanjang Hari:
                  </span>
                  {(eventsByDate.get(anchorIso) || [])
                    .filter((e) => e.sepanjangHari)
                    .map((ev) => {
                      const st = getKategoriStyle(ev.kategori);
                      const evStatus = normalizeAgendaStatus(ev.status);
                      const isCancelled = evStatus === 'dibatalkan';
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onOpenEvent(ev)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                            isCancelled
                              ? 'bg-slate-100 hover:bg-slate-200/70 border-slate-300 text-slate-500'
                              : `${st.bg} ${st.bgHover} ${st.border} ${st.text}`
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-xs ${isCancelled ? 'bg-slate-400' : st.dot}`} />
                          <span className={isCancelled ? 'line-through' : ''}>{ev.judul}</span>
                          {evStatus !== 'terjadwal' && (
                            <span className={`text-[10px] font-bold ${isCancelled ? 'text-rose-700' : 'text-amber-800'}`}>
                              · {getAgendaStatusLabel(ev.status)}
                            </span>
                          )}
                          <span className="opacity-75 text-[11px]">· {ev.lokasi}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              <div className="grid grid-cols-[72px_1fr] relative">
                <div className="border-r border-slate-200 bg-slate-50/50">
                  {GRID_HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="h-16 pr-3 pt-1.5 text-right text-[11px] font-mono text-slate-500 tabular-nums border-b border-slate-100"
                    >
                      {pad2(hour)}:00
                    </div>
                  ))}
                </div>

                <div className="relative bg-white">
                  {GRID_HOURS.map((hour) => (
                    <div
                      key={hour}
                      onClick={() =>
                        onOpenCreate({
                          date: anchorIso,
                          jamMulai: `${pad2(hour)}:00`,
                          jamSelesai: minutesToHhmm((hour + 1) * 60),
                        })
                      }
                      className="h-16 border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors px-3 flex items-center"
                    >
                      <span className="text-[11px] text-slate-300 opacity-0 hover:opacity-100 select-none">
                        + Tambah agenda pukul {pad2(hour)}:00
                      </span>
                    </div>
                  ))}

                  {layoutOverlappingDayEvents(eventsByDate.get(anchorIso) || []).map((item) => {
                    const st = getKategoriStyle(item.event.kategori);
                    const evStatus = normalizeAgendaStatus(item.event.status);
                    const isCancelled = evStatus === 'dibatalkan';
                    const isRescheduled = evStatus === 'dijadwalkan_ulang';
                    const widthPct = 100 / item.colCount;
                    const leftPct = item.colIndex * widthPct;
                    return (
                      <button
                        key={item.event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEvent(item.event);
                        }}
                        style={{
                          top: `${item.topPct}%`,
                          height: `${item.heightPct}%`,
                          left: `calc(${leftPct}% + 6px)`,
                          width: `calc(${widthPct}% - 12px)`,
                        }}
                        className={`absolute z-10 rounded-xl border p-2.5 text-left overflow-hidden shadow-xs transition-colors flex flex-col justify-between ${
                          isCancelled
                            ? 'bg-slate-100 hover:bg-slate-200/70 border-slate-300 text-slate-500'
                            : `${st.bg} ${st.bgHover} ${st.border} ${st.text}`
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-mono font-bold tabular-nums">
                              {item.event.jamMulai}–{item.event.jamSelesai} WIB
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-white/70 border border-current/20 text-[10px] font-semibold">
                              {item.event.kategori}
                            </span>
                            {(isCancelled || isRescheduled) && (
                              <span
                                className={`font-bold text-[10px] ${
                                  isCancelled ? 'text-rose-700' : 'text-amber-800'
                                }`}
                              >
                                · {getAgendaStatusLabel(item.event.status)}
                              </span>
                            )}
                          </div>
                          <div className={`font-bold text-xs sm:text-sm truncate ${isCancelled ? 'line-through' : ''}`}>
                            {item.event.judul}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] opacity-90 truncate">
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.event.lokasi}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <Users className="w-3 h-3 shrink-0" />
                            <span className="truncate">{renderAttendeeSummary(item.event)}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: JADWAL (CHRONOLOGICAL LIST) */}
          {viewMode === 'jadwal' && (
            <div className="p-4 sm:p-5">
              {groupedJadwalDates.length === 0 ? (
                <div className="py-12 px-4 text-center max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <List className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      Belum ada agenda kegiatan yang cocok
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tambahkan jadwal rapat, tinjauan lapangan, asistensi, atau audiensi agar seluruh personel tim mengetahui waktu, lokasi, dan peserta yang menghadiri.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCreate({ date: anchorIso, jamMulai: '09:00', jamSelesai: '10:00' })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Agenda Pertama</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedJadwalDates.map((group) => {
                    const parts = parseIsoDateParts(group.tanggal);
                    const dow = getDayOfWeekMonFirst(group.tanggal);
                    const isToday = group.tanggal === todayIso;
                    return (
                      <div
                        key={group.tanggal}
                        className="flex flex-col sm:flex-row gap-3 pb-4 border-b last:border-b-0 border-slate-200"
                      >
                        {/* Date Label Column */}
                        <div className="sm:w-40 shrink-0 flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0.5 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold tabular-nums ${
                                isToday
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-900 border border-slate-200'
                              }`}
                            >
                              {parts.day}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {NAMA_HARI_FULL[dow]}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {NAMA_BULAN[parts.monthIndex]} {parts.year}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Day's Event Cards */}
                        <div className="flex-1 space-y-2 min-w-0">
                          {group.items.map((ev) => {
                            const st = getKategoriStyle(ev.kategori);
                            const evStatus = normalizeAgendaStatus(ev.status);
                            const isCancelled = evStatus === 'dibatalkan';
                            const isRescheduled = evStatus === 'dijadwalkan_ulang';
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => onOpenEvent(ev)}
                                className={`w-full text-left p-3.5 rounded-xl border transition-colors space-y-2 ${
                                  isCancelled
                                    ? 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${st.bg} ${st.border} ${st.text}`}>
                                      <span className={`w-2 h-2 rounded-xs ${st.dot}`} />
                                      {ev.kategori}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      {formatAgendaTimeRange(ev)}
                                    </span>
                                    {(isCancelled || isRescheduled) && (
                                      <span
                                        className={`text-xs font-bold whitespace-nowrap ${
                                          isCancelled ? 'text-rose-700' : 'text-amber-800'
                                        }`}
                                      >
                                        · {getAgendaStatusLabel(ev.status)}
                                        {isRescheduled && ev.tanggalSebelumnya
                                          ? ` (dari ${formatIndonesianDateFull(ev.tanggalSebelumnya)})`
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                    Oleh: {ev.dibuatOlehNama}
                                  </span>
                                </div>

                                <div
                                  className={`text-sm font-bold ${
                                    isCancelled ? 'line-through text-slate-500' : 'text-slate-900'
                                  }`}
                                >
                                  {ev.judul}
                                </div>

                                {ev.alasanStatus && (
                                  <div className="text-[11px] text-slate-600">
                                    Keterangan status: {ev.alasanStatus}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{ev.lokasi}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>
                                      {ev.pesertaNama.length > 0
                                        ? ev.pesertaNama.join(', ')
                                        : 'Tidak ada personel internal'}
                                    </span>
                                  </span>
                                  {ev.pesertaTambahan && (
                                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{ev.pesertaTambahan}</span>
                                    </span>
                                  )}
                                </div>

                                {ev.catatan && (
                                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
                                    {ev.catatan}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* VIEW 5: REKAP AGENDA (HARIAN, MINGGUAN, BULANAN, RANGE TANGGAL) */}
          {viewMode === 'rekap' && (
            <AgendaRekapPanel
              agendaList={agendaList}
              personelList={personelList}
              pejabatConfig={pejabatConfig}
              initialAnchorDate={anchorIso}
              initialKategori={selectedKategori}
              initialPersonel={selectedPersonel}
              initialSearchQuery={searchQuery}
              onOpenCreate={onOpenCreate}
              onOpenEvent={onOpenEvent}
              onNotify={onNotify}
            />
          )}
        </section>
      </div>
    </div>
  );
};
